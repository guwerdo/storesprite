import React from 'react';
import {
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import StorageIcon from '@mui/icons-material/Storage';
import CableIcon from '@mui/icons-material/Cable';
import { useFormContext, Controller } from 'react-hook-form';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';
import type { ConnectionFormValues } from '../schema/connectionFormSchema.js';
import type { DataConnectionChannel } from '../../../../types/stocksprite/DataConnection.interface.js';

export function ChannelConfigSection(): React.JSX.Element {
  const { t } = useAppTranslation();
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ConnectionFormValues>();

  const channel = watch('channel');

  const handleChannelChange = (newChannel: DataConnectionChannel): void => {
    if (newChannel === channel) return;
    setValue('channel', newChannel, { shouldDirty: true, shouldValidate: true });

    // Reset credentials state to default for new channel
    setValue('httpAuthType', 'NONE', { shouldDirty: true });
    setValue('httpBasicUsername', '', { shouldDirty: true });
    setValue('httpBasicPassword', '', { shouldDirty: true });
    setValue('httpBearerToken', '', { shouldDirty: true });
    setValue('httpApiKeyHeaderName', 'X-Api-Key', { shouldDirty: true });
    setValue('httpApiKeyHeaderValue', '', { shouldDirty: true });

    setValue('sftpAuthType', 'PASSWORD', { shouldDirty: true });
    setValue('sftpPasswordUsername', '', { shouldDirty: true });
    setValue('sftpPasswordPassword', '', { shouldDirty: true });
    setValue('sftpKeyUsername', '', { shouldDirty: true });
    setValue('sftpPrivateKey', '', { shouldDirty: true });
    setValue('sftpKeyPassphrase', '', { shouldDirty: true });
  };

  return (
    <>
      {/* Channel Selection Card */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CableIcon color="primary" fontSize="small" />
            {t('stocksprite.connections.form.channel')}
          </Typography>
          <FormControl fullWidth required>
            <InputLabel id="connection-channel-label">{t('stocksprite.connections.form.channel')}</InputLabel>
            <Select
              labelId="connection-channel-label"
              id="connection-channel-select"
              value={channel}
              label={t('stocksprite.connections.form.channel')}
              onChange={(e) => handleChannelChange(e.target.value as DataConnectionChannel)}
            >
              <MenuItem value="HTTP">HTTP / HTTPS</MenuItem>
              <MenuItem value="SFTP">SFTP (SSH File Transfer)</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* HTTP Channel Config */}
      {channel === 'HTTP' && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LanguageIcon color="primary" fontSize="small" />
              {t('stocksprite.connections.form.http.title')}
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  autoComplete="off"
                  label={t('stocksprite.connections.form.http.url')}
                  placeholder={t('stocksprite.connections.form.http.urlPlaceholder')}
                  {...register('httpUrl')}
                  error={Boolean(errors.httpUrl)}
                  helperText={errors.httpUrl?.message || t('stocksprite.connections.form.http.urlHelper')}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel id="http-method-label">{t('stocksprite.connections.form.http.method')}</InputLabel>
                  <Controller
                    name="httpMethod"
                    control={control}
                    render={({ field }) => (
                      <Select
                        labelId="http-method-label"
                        id="http-method-select"
                        {...field}
                        label={t('stocksprite.connections.form.http.method')}
                      >
                        <MenuItem value="GET">GET</MenuItem>
                        <MenuItem value="POST">POST</MenuItem>
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  autoComplete="off"
                  label={t('stocksprite.connections.form.http.timeout')}
                  {...register('httpTimeoutSeconds')}
                  inputProps={{ min: 1, max: 300 }}
                  helperText={t('stocksprite.connections.form.http.timeoutHelper')}
                />
              </Grid>

              <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <Controller
                  name="httpInsecureIgnoreSsl"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label={t('stocksprite.connections.form.http.insecureSsl')}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* SFTP Channel Config */}
      {channel === 'SFTP' && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" fontSize="small" />
              {t('stocksprite.connections.form.sftp.title')}
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  required
                  autoComplete="off"
                  label={t('stocksprite.connections.form.sftp.host')}
                  placeholder={t('stocksprite.connections.form.sftp.hostPlaceholder')}
                  {...register('sftpHost')}
                  error={Boolean(errors.sftpHost)}
                  helperText={errors.sftpHost?.message}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  autoComplete="off"
                  label={t('stocksprite.connections.form.sftp.port')}
                  {...register('sftpPort')}
                  inputProps={{ min: 1, max: 65535 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  autoComplete="off"
                  label={t('stocksprite.connections.form.sftp.remoteDir')}
                  placeholder={t('stocksprite.connections.form.sftp.remoteDirPlaceholder')}
                  {...register('sftpRemoteDir')}
                  error={Boolean(errors.sftpRemoteDir)}
                  helperText={errors.sftpRemoteDir?.message || t('stocksprite.connections.form.sftp.remoteDirHelper')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="sftp-strategy-label">{t('stocksprite.connections.form.sftp.strategy')}</InputLabel>
                  <Controller
                    name="sftpFileSelectionStrategy"
                    control={control}
                    render={({ field }) => (
                      <Select
                        labelId="sftp-strategy-label"
                        id="sftp-strategy-select"
                        {...field}
                        label={t('stocksprite.connections.form.sftp.strategy')}
                      >
                        <MenuItem value="LATEST_ALPHABETICAL">
                          {t('stocksprite.connections.form.sftp.strategies.latestAlphabetical')}
                        </MenuItem>
                        <MenuItem value="LATEST_MODIFIED">
                          {t('stocksprite.connections.form.sftp.strategies.latestModified')}
                        </MenuItem>
                        <MenuItem value="EXACT_MATCH">
                          {t('stocksprite.connections.form.sftp.strategies.exactMatch')}
                        </MenuItem>
                      </Select>
                    )}
                  />
                  <FormHelperText>{t('stocksprite.connections.form.sftp.strategyHelper')}</FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </>
  );
}
