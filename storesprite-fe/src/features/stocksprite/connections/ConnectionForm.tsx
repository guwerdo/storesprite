import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import StorageIcon from '@mui/icons-material/Storage';
import TableViewIcon from '@mui/icons-material/TableView';
import CodeIcon from '@mui/icons-material/Code';
import CableIcon from '@mui/icons-material/Cable';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type {
  DataConnectionChannel,
  DataConnectionFormat,
  IDataConnection,
  ICreateConnectionPayload,
  HttpConnectionConfig,
  SftpConnectionConfig,
  CsvDataFormatConfig,
  XmlDataFormatConfig,
} from '../../../types/DataConnection.interface.js';

export interface ConnectionFormProps {
  initialConnection?: IDataConnection | null;
  onSave: (payload: ICreateConnectionPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function ConnectionForm({
  initialConnection,
  onSave,
  onDelete,
  onCancel,
  saving = false,
}: ConnectionFormProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const isEditing = Boolean(initialConnection?.id);

  // Form Base State
  const [name, setName] = useState(initialConnection?.name || '');
  const [channel, setChannel] = useState<DataConnectionChannel>(initialConnection?.channel || 'HTTP');
  const [dataFormat, setDataFormat] = useState<DataConnectionFormat>(initialConnection?.dataFormat || 'CSV');
  const [isActive, setIsActive] = useState<boolean>(
    initialConnection?.isActive !== undefined ? initialConnection.isActive : true
  );

  // HTTP Transport State
  const httpInitial = (initialConnection?.channel === 'HTTP' ? initialConnection.config : {}) as Partial<HttpConnectionConfig>;
  const [httpUrl, setHttpUrl] = useState(httpInitial.url || '');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST'>(httpInitial.method || 'GET');
  const [httpInsecureSsl, setHttpInsecureSsl] = useState<boolean>(Boolean(httpInitial.insecureIgnoreSsl));
  const [httpTimeout, setHttpTimeout] = useState<string>(
    httpInitial.timeoutSeconds ? String(httpInitial.timeoutSeconds) : '30'
  );

  // SFTP Transport State
  const sftpInitial = (initialConnection?.channel === 'SFTP' ? initialConnection.config : {}) as Partial<SftpConnectionConfig>;
  const [sftpHost, setSftpHost] = useState(sftpInitial.host || '');
  const [sftpPort, setSftpPort] = useState<string>(sftpInitial.port ? String(sftpInitial.port) : '22');
  const [sftpRemoteDir, setSftpRemoteDir] = useState(sftpInitial.remoteDir || '/');
  const [sftpFileStrategy, setSftpFileStrategy] = useState<
    'LATEST_ALPHABETICAL' | 'LATEST_MODIFIED' | 'EXACT_MATCH'
  >(sftpInitial.fileSelectionStrategy || 'LATEST_ALPHABETICAL');

  // CSV Parser State
  const csvInitial = (initialConnection?.dataFormat === 'CSV' ? initialConnection.dataFormatConfig : {}) as Partial<CsvDataFormatConfig>;
  const [csvDelimiter, setCsvDelimiter] = useState(csvInitial.delimiter || ';');
  const [csvEncoding, setCsvEncoding] = useState(csvInitial.encoding || 'UTF-8');
  const [csvHasHeaders, setCsvHasHeaders] = useState<boolean>(
    csvInitial.hasHeaders !== undefined ? Boolean(csvInitial.hasHeaders) : true
  );

  // XML Parser State
  const xmlInitial = (initialConnection?.dataFormat === 'XML' ? initialConnection.dataFormatConfig : {}) as Partial<XmlDataFormatConfig>;
  const [xmlRowPath, setXmlRowPath] = useState(xmlInitial.rowPath || './/product');
  const [xmlIncludeAttributes, setXmlIncludeAttributes] = useState<boolean>(
    Boolean(xmlInitial.includeAttributes)
  );
  const [xmlAttributePrefix, setXmlAttributePrefix] = useState(xmlInitial.attributePrefix || '');

  // UI / Modal / Validation State
  const [touched, setTouched] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Field Validations
  const nameError = touched && (!name.trim() ? t('stocksprite.connections.form.nameRequired') : name.length > 255 ? t('stocksprite.connections.form.nameMaxLength') : '');
  
  const httpUrlError =
    touched &&
    channel === 'HTTP' &&
    (!httpUrl.trim()
      ? t('stocksprite.connections.form.http.urlRequired')
      : !httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')
      ? t('stocksprite.connections.form.http.urlInvalid')
      : '');

  const sftpHostError =
    touched && channel === 'SFTP' && !sftpHost.trim() ? t('stocksprite.connections.form.sftp.hostRequired') : '';
  const sftpRemoteDirError =
    touched && channel === 'SFTP' && !sftpRemoteDir.trim()
      ? t('stocksprite.connections.form.sftp.remoteDirRequired')
      : '';

  const csvDelimiterError =
    touched && dataFormat === 'CSV' && !csvDelimiter ? t('stocksprite.connections.form.csv.delimiterRequired') : '';

  const xmlRowPathError =
    touched && dataFormat === 'XML' && !xmlRowPath.trim()
      ? t('stocksprite.connections.form.xml.rowPathRequired')
      : '';

  const isFormValid =
    name.trim().length > 0 &&
    name.length <= 255 &&
    (channel === 'HTTP' ? httpUrl.trim().length > 0 && (httpUrl.startsWith('http://') || httpUrl.startsWith('https://')) : sftpHost.trim().length > 0 && sftpRemoteDir.trim().length > 0) &&
    (dataFormat === 'CSV' ? csvDelimiter.length > 0 : xmlRowPath.trim().length > 0);

  const handleSave = async (): Promise<void> => {
    setTouched(true);
    setSubmitError(null);

    if (!isFormValid) {
      return;
    }

    try {
      const configPayload =
        channel === 'HTTP'
          ? ({
              channel: 'HTTP',
              url: httpUrl.trim(),
              method: httpMethod,
              insecureIgnoreSsl: httpInsecureSsl,
              timeoutSeconds: httpTimeout ? parseInt(httpTimeout, 10) : undefined,
            } as HttpConnectionConfig)
          : ({
              channel: 'SFTP',
              host: sftpHost.trim(),
              port: sftpPort ? parseInt(sftpPort, 10) : 22,
              remoteDir: sftpRemoteDir.trim(),
              fileSelectionStrategy: sftpFileStrategy,
            } as SftpConnectionConfig);

      const dataFormatPayload =
        dataFormat === 'CSV'
          ? ({
              format: 'CSV',
              delimiter: csvDelimiter,
              encoding: csvEncoding || 'UTF-8',
              hasHeaders: csvHasHeaders,
            } as CsvDataFormatConfig)
          : ({
              format: 'XML',
              rowPath: xmlRowPath.trim(),
              includeAttributes: xmlIncludeAttributes,
              attributePrefix: xmlAttributePrefix || '',
            } as XmlDataFormatConfig);

      const payload: ICreateConnectionPayload = {
        name: name.trim(),
        channel,
        dataFormat,
        isActive,
        config: configPayload,
        dataFormatConfig: dataFormatPayload,
      };

      await onSave(payload);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || t('stocksprite.connections.form.saveFailed'));
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    setDeleteModalOpen(false);
    if (initialConnection?.id && onDelete) {
      try {
        await onDelete(initialConnection.id);
      } catch (err: unknown) {
        setSubmitError((err as Error).message || t('stocksprite.connections.form.deleteFailed'));
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2 }}>
      {/* Top Header & Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onCancel}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {t('stocksprite.connections.form.buttons.backToList')}
        </Button>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {isEditing ? t('stocksprite.connections.form.editTitle') : t('stocksprite.connections.form.addTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('stocksprite.connections.form.subtitle')}
          </Typography>
        </Box>
      </Box>

      {submitError && (
        <Alert severity="error" onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {/* Main Base Settings Card */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('stocksprite.config.title')}
          </Typography>

          <Grid container spacing={3}>
            {/* Connection Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label={t('stocksprite.connections.form.name')}
                placeholder={t('stocksprite.connections.form.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={Boolean(nameError)}
                helperText={nameError || 'Max 255 characters'}
              />
            </Grid>

            {/* Active Switch */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    color="primary"
                  />
                }
                label={t('stocksprite.connections.form.isActive')}
              />
              <FormHelperText>{t('stocksprite.connections.form.isActiveHelper')}</FormHelperText>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Channel Selection Pane */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CableIcon color="primary" fontSize="small" />
            {t('stocksprite.connections.form.channel')}
          </Typography>
          <FormControl fullWidth required>
            <InputLabel>{t('stocksprite.connections.form.channel')}</InputLabel>
            <Select
              value={channel}
              label={t('stocksprite.connections.form.channel')}
              onChange={(e) => setChannel(e.target.value as DataConnectionChannel)}
            >
              <MenuItem value="HTTP">HTTP / HTTPS</MenuItem>
              <MenuItem value="SFTP">SFTP (SSH File Transfer)</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Dynamic Sub-Form: Transport Layer (HTTP / SFTP) */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {channel === 'HTTP' ? <LanguageIcon color="primary" /> : <StorageIcon color="secondary" />}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {channel === 'HTTP'
                ? t('stocksprite.connections.form.http.title')
                : t('stocksprite.connections.form.sftp.title')}
            </Typography>
          </Box>

          {channel === 'HTTP' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  required
                  label={t('stocksprite.connections.form.http.url')}
                  placeholder={t('stocksprite.connections.form.http.urlPlaceholder')}
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  error={Boolean(httpUrlError)}
                  helperText={httpUrlError}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('stocksprite.connections.form.http.method')}</InputLabel>
                  <Select
                    value={httpMethod}
                    label={t('stocksprite.connections.form.http.method')}
                    onChange={(e) => setHttpMethod(e.target.value as 'GET' | 'POST')}
                  >
                    <MenuItem value="GET">GET</MenuItem>
                    <MenuItem value="POST">POST</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('stocksprite.connections.form.http.timeout')}
                  value={httpTimeout}
                  onChange={(e) => setHttpTimeout(e.target.value)}
                  inputProps={{ min: 1, max: 300 }}
                />
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={httpInsecureSsl}
                      onChange={(e) => setHttpInsecureSsl(e.target.checked)}
                    />
                  }
                  label={t('stocksprite.connections.form.http.insecureSsl')}
                />
              </Grid>
            </Grid>
          )}

          {channel === 'SFTP' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  required
                  label={t('stocksprite.connections.form.sftp.host')}
                  placeholder={t('stocksprite.connections.form.sftp.hostPlaceholder')}
                  value={sftpHost}
                  onChange={(e) => setSftpHost(e.target.value)}
                  error={Boolean(sftpHostError)}
                  helperText={sftpHostError}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('stocksprite.connections.form.sftp.port')}
                  value={sftpPort}
                  onChange={(e) => setSftpPort(e.target.value)}
                  inputProps={{ min: 1, max: 65535 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label={t('stocksprite.connections.form.sftp.remoteDir')}
                  placeholder={t('stocksprite.connections.form.sftp.remoteDirPlaceholder')}
                  value={sftpRemoteDir}
                  onChange={(e) => setSftpRemoteDir(e.target.value)}
                  error={Boolean(sftpRemoteDirError)}
                  helperText={sftpRemoteDirError}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('stocksprite.connections.form.sftp.fileStrategy')}</InputLabel>
                  <Select
                    value={sftpFileStrategy}
                    label={t('stocksprite.connections.form.sftp.fileStrategy')}
                    onChange={(e) =>
                      setSftpFileStrategy(
                        e.target.value as 'LATEST_ALPHABETICAL' | 'LATEST_MODIFIED' | 'EXACT_MATCH'
                      )
                    }
                  >
                    <MenuItem value="LATEST_ALPHABETICAL">
                      {t('stocksprite.connections.form.sftp.strategyAlphabetical')}
                    </MenuItem>
                    <MenuItem value="LATEST_MODIFIED">
                      {t('stocksprite.connections.form.sftp.strategyModified')}
                    </MenuItem>
                    <MenuItem value="EXACT_MATCH">
                      {t('stocksprite.connections.form.sftp.strategyExact')}
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Data Format Selection Pane */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SchemaOutlinedIcon color="primary" fontSize="small" />
            {t('stocksprite.connections.form.dataFormat')}
          </Typography>
          <FormControl fullWidth required>
            <InputLabel>{t('stocksprite.connections.form.dataFormat')}</InputLabel>
            <Select
              value={dataFormat}
              label={t('stocksprite.connections.form.dataFormat')}
              onChange={(e) => setDataFormat(e.target.value as DataConnectionFormat)}
            >
              <MenuItem value="CSV">CSV (Comma / Semicolon Separated)</MenuItem>
              <MenuItem value="XML">XML (Extensible Markup Language)</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Dynamic Sub-Form: Parser Layer (CSV / XML) */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {dataFormat === 'CSV' ? <TableViewIcon color="success" /> : <CodeIcon color="warning" />}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {dataFormat === 'CSV'
                ? t('stocksprite.connections.form.csv.title')
                : t('stocksprite.connections.form.xml.title')}
            </Typography>
          </Box>

          {dataFormat === 'CSV' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required error={Boolean(csvDelimiterError)}>
                  <InputLabel>{t('stocksprite.connections.form.csv.delimiter')}</InputLabel>
                  <Select
                    value={csvDelimiter}
                    label={t('stocksprite.connections.form.csv.delimiter')}
                    onChange={(e) => setCsvDelimiter(e.target.value)}
                  >
                    <MenuItem value=",">{t('stocksprite.connections.form.csv.delimiterComma')}</MenuItem>
                    <MenuItem value=";">{t('stocksprite.connections.form.csv.delimiterSemicolon')}</MenuItem>
                    <MenuItem value="\t">{t('stocksprite.connections.form.csv.delimiterTab')}</MenuItem>
                    <MenuItem value="|">{t('stocksprite.connections.form.csv.delimiterPipe')}</MenuItem>
                  </Select>
                  {csvDelimiterError && <FormHelperText>{csvDelimiterError}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('stocksprite.connections.form.csv.encoding')}</InputLabel>
                  <Select
                    value={csvEncoding}
                    label={t('stocksprite.connections.form.csv.encoding')}
                    onChange={(e) => setCsvEncoding(e.target.value)}
                  >
                    <MenuItem value="UTF-8">{t('stocksprite.connections.form.csv.encodingUtf8')}</MenuItem>
                    <MenuItem value="UTF-8-BOM">{t('stocksprite.connections.form.csv.encodingUtf8Bom')}</MenuItem>
                    <MenuItem value="windows-1250">{t('stocksprite.connections.form.csv.encodingWin1250')}</MenuItem>
                    <MenuItem value="windows-1252">{t('stocksprite.connections.form.csv.encodingWin1252')}</MenuItem>
                    <MenuItem value="ISO-8859-2">{t('stocksprite.connections.form.csv.encodingIso88592')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={csvHasHeaders}
                      onChange={(e) => setCsvHasHeaders(e.target.checked)}
                    />
                  }
                  label={t('stocksprite.connections.form.csv.hasHeaders')}
                />
              </Grid>
            </Grid>
          )}

          {dataFormat === 'XML' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label={t('stocksprite.connections.form.xml.rowPath')}
                  placeholder={t('stocksprite.connections.form.xml.rowPathPlaceholder')}
                  value={xmlRowPath}
                  onChange={(e) => setXmlRowPath(e.target.value)}
                  error={Boolean(xmlRowPathError)}
                  helperText={xmlRowPathError}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('stocksprite.connections.form.xml.attributePrefix')}
                  placeholder={t('stocksprite.connections.form.xml.attributePrefixPlaceholder')}
                  value={xmlAttributePrefix}
                  onChange={(e) => setXmlAttributePrefix(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={xmlIncludeAttributes}
                      onChange={(e) => setXmlIncludeAttributes(e.target.checked)}
                    />
                  }
                  label={t('stocksprite.connections.form.xml.includeAttributes')}
                />
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Bottom Action Bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 2,
          pt: 1,
        }}
      >
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={!isEditing}
          onClick={() => setDeleteModalOpen(true)}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t('stocksprite.connections.form.buttons.delete')}
        </Button>

        <Button
          variant="outlined"
          color="secondary"
          startIcon={<PlayArrowIcon />}
          disabled={!isFormValid || !isEditing}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t('stocksprite.connections.form.buttons.test')}
        </Button>

        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          disabled={saving}
          onClick={() => void handleSave()}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}
        >
          {saving ? t('stocksprite.connections.form.buttons.saving') : t('stocksprite.connections.form.buttons.save')}
        </Button>
      </Box>

      {/* Delete Confirmation Modal Dialog */}
      <Dialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {t('stocksprite.connections.form.deleteModal.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('stocksprite.connections.form.deleteModal.prompt')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteModalOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
            {t('stocksprite.connections.form.deleteModal.no')}
          </Button>
          <Button
            onClick={() => void handleDeleteConfirm()}
            color="error"
            variant="contained"
            autoFocus
            sx={{ textTransform: 'none' }}
          >
            {t('stocksprite.connections.form.deleteModal.yes')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
