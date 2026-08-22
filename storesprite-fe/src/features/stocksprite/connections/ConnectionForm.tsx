import React, { useRef, useState, useEffect } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import KeyIcon from '@mui/icons-material/Key';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type { ISocketService } from '../../../types/SocketService.interface.js';
import type {
  DataConnectionChannel,
  DataConnectionFormat,
  IDataConnection,
  ICreateConnectionPayload,
  HttpConnectionConfig,
  SftpConnectionConfig,
  CsvDataFormatConfig,
  XmlDataFormatConfig,
  HttpAuthType,
  SftpAuthType,
  ConnectionCredentials,
  ConnectionTestResult,
  ConnectionTestProgress,
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
  const { getToken, userId: clerkUserId } = useAuth();
  const connectionService = useInjection<IConnectionService>(TYPES.IConnectionService);
  const socketService = useInjection<ISocketService>(TYPES.ISocketService);

  const isEditing = Boolean(initialConnection?.id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form Base State
  const [name, setName] = useState(initialConnection?.name || '');
  const [channel, setChannel] = useState<DataConnectionChannel>(initialConnection?.channel || 'HTTP');
  const [dataFormat, setDataFormat] = useState<DataConnectionFormat>(initialConnection?.dataFormat || 'CSV');
  const [isActive, setIsActive] = useState<boolean>(
    initialConnection?.isActive !== undefined ? initialConnection.isActive : false
  );

  // Testing & TestResult State
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    initialConnection?.testResult ?? null
  );
  const [testingProgress, setTestingProgress] = useState<ConnectionTestProgress>(
    initialConnection?.testResult?.progress ?? null
  );
  const [isTestingRunning, setIsTestingRunning] = useState<boolean>(
    Boolean(
      initialConnection?.testResult?.progress &&
        initialConnection.testResult.progress !== 'finish'
    )
  );
  const [hasEditedSinceTest, setHasEditedSinceTest] = useState<boolean>(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Socket.IO real-time progress subscription
  useEffect(() => {
    if (clerkUserId) {
      socketService.connect(clerkUserId);
    }

    const onProgress = (data: { connectionId: string; progress: ConnectionTestProgress }): void => {
      if (initialConnection?.id && data.connectionId === initialConnection.id) {
        setTestingProgress(data.progress);
        if (data.progress === 'start' || data.progress === 'download' || data.progress === 'convert') {
          setIsTestingRunning(true);
        }
      }
    };

    const onResult = (data: { connectionId: string; testResult: ConnectionTestResult }): void => {
      if (initialConnection?.id && data.connectionId === initialConnection.id) {
        setTestResult(data.testResult);
        setTestingProgress(data.testResult.progress ?? null);
        setIsTestingRunning(false);
        setHasEditedSinceTest(false);
      }
    };

    const onInvalidated = (data: { connectionId: string }): void => {
      if (initialConnection?.id && data.connectionId === initialConnection.id) {
        setTestResult(null);
        setTestingProgress(null);
        setIsTestingRunning(false);
      }
    };

    socketService.on('connection_test_progress', onProgress);
    socketService.on('connection_test_result', onResult);
    socketService.on('connection_test_invalidated', onInvalidated);

    return () => {
      socketService.off('connection_test_progress', onProgress);
      socketService.off('connection_test_result', onResult);
      socketService.off('connection_test_invalidated', onInvalidated);
    };
  }, [clerkUserId, initialConnection?.id, socketService]);

  // 15-minute fallback timeout for running test
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isTestingRunning) {
      timer = setTimeout(() => {
        setIsTestingRunning(false);
        setTestingProgress('finish');
        setTestError(t('stocksprite.connections.form.testing.timeout'));
      }, 15 * 60 * 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isTestingRunning, t]);

  const markEdited = (): void => {
    if (testResult && !hasEditedSinceTest) {
      setHasEditedSinceTest(true);
    }
  };

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

  // Credentials State
  const initialCreds = initialConnection?.credentials as Record<string, unknown> | undefined;
  const isHttpChannel = initialConnection?.channel === 'HTTP';
  const isSftpChannel = initialConnection?.channel === 'SFTP';

  // HTTP Credentials State
  const [httpAuthType, setHttpAuthType] = useState<HttpAuthType>(
    isHttpChannel && typeof initialCreds?.authType === 'string'
      ? (initialCreds.authType as HttpAuthType)
      : 'NONE'
  );
  const [httpBasicUsername, setHttpBasicUsername] = useState<string>(
    isHttpChannel && typeof initialCreds?.username === 'string' ? initialCreds.username : ''
  );
  const [httpBasicPassword, setHttpBasicPassword] = useState<string>(
    isHttpChannel && typeof initialCreds?.password === 'string' ? initialCreds.password : ''
  );
  const [httpBearerToken, setHttpBearerToken] = useState<string>(
    isHttpChannel && typeof initialCreds?.token === 'string' ? initialCreds.token : ''
  );
  const [httpApiKeyHeaderName, setHttpApiKeyHeaderName] = useState<string>(
    isHttpChannel && typeof initialCreds?.headerName === 'string' ? initialCreds.headerName : 'X-Api-Key'
  );
  const [httpApiKeyHeaderValue, setHttpApiKeyHeaderValue] = useState<string>(
    isHttpChannel && typeof initialCreds?.headerValue === 'string' ? initialCreds.headerValue : ''
  );

  // SFTP Credentials State
  const [sftpAuthType, setSftpAuthType] = useState<SftpAuthType>(
    isSftpChannel && typeof initialCreds?.authType === 'string'
      ? (initialCreds.authType as SftpAuthType)
      : 'PASSWORD'
  );
  const [sftpPasswordUsername, setSftpPasswordUsername] = useState<string>(
    isSftpChannel && initialCreds?.authType === 'PASSWORD' && typeof initialCreds?.username === 'string'
      ? initialCreds.username
      : ''
  );
  const [sftpPasswordPassword, setSftpPasswordPassword] = useState<string>(
    isSftpChannel && initialCreds?.authType === 'PASSWORD' && typeof initialCreds?.password === 'string'
      ? initialCreds.password
      : ''
  );
  const [sftpKeyUsername, setSftpKeyUsername] = useState<string>(
    isSftpChannel && initialCreds?.authType === 'PRIVATE_KEY' && typeof initialCreds?.username === 'string'
      ? initialCreds.username
      : ''
  );
  const [sftpPrivateKey, setSftpPrivateKey] = useState<string>(
    isSftpChannel && initialCreds?.authType === 'PRIVATE_KEY' && typeof initialCreds?.privateKey === 'string'
      ? initialCreds.privateKey
      : ''
  );
  const [sftpKeyPassphrase, setSftpKeyPassphrase] = useState<string>(
    isSftpChannel && initialCreds?.authType === 'PRIVATE_KEY' && typeof initialCreds?.passphrase === 'string'
      ? initialCreds.passphrase
      : ''
  );

  // Password Visibility Toggles
  const [showBasicPassword, setShowBasicPassword] = useState(false);
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);
  const [showSftpPassword, setShowSftpPassword] = useState(false);
  const [showSftpPassphrase, setShowSftpPassphrase] = useState(false);

  // UI / Modal / Validation State
  const [touched, setTouched] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Channel switch handler with isolation
  const handleChannelChange = (newChannel: DataConnectionChannel): void => {
    if (newChannel === channel) return;
    markEdited();
    setChannel(newChannel);

    // Reset credentials state to default for new channel
    setHttpAuthType('NONE');
    setHttpBasicUsername('');
    setHttpBasicPassword('');
    setHttpBearerToken('');
    setHttpApiKeyHeaderName('X-Api-Key');
    setHttpApiKeyHeaderValue('');

    setSftpAuthType('PASSWORD');
    setSftpPasswordUsername('');
    setSftpPasswordPassword('');
    setSftpKeyUsername('');
    setSftpPrivateKey('');
    setSftpKeyPassphrase('');
  };

  // SSH Key file upload handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        markEdited();
        setSftpPrivateKey(content);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Field Validations
  const nameError =
    touched &&
    (!name.trim()
      ? t('stocksprite.connections.form.nameRequired')
      : name.length > 255
      ? t('stocksprite.connections.form.nameMaxLength')
      : '');

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

  // Credentials Validations
  const httpBasicUsernameError =
    touched && channel === 'HTTP' && httpAuthType === 'BASIC' && !httpBasicUsername.trim()
      ? t('stocksprite.connections.form.credentials.http.usernameRequired')
      : '';
  const httpBasicPasswordError =
    touched && channel === 'HTTP' && httpAuthType === 'BASIC' && !httpBasicPassword
      ? t('stocksprite.connections.form.credentials.http.passwordRequired')
      : '';
  const httpBearerTokenError =
    touched && channel === 'HTTP' && httpAuthType === 'BEARER' && !httpBearerToken.trim()
      ? t('stocksprite.connections.form.credentials.http.tokenRequired')
      : '';
  const httpApiKeyHeaderNameError =
    touched && channel === 'HTTP' && httpAuthType === 'API_KEY' && !httpApiKeyHeaderName.trim()
      ? t('stocksprite.connections.form.credentials.http.headerNameRequired')
      : '';
  const httpApiKeyHeaderValueError =
    touched && channel === 'HTTP' && httpAuthType === 'API_KEY' && !httpApiKeyHeaderValue.trim()
      ? t('stocksprite.connections.form.credentials.http.headerValueRequired')
      : '';

  const sftpPasswordUsernameError =
    touched && channel === 'SFTP' && sftpAuthType === 'PASSWORD' && !sftpPasswordUsername.trim()
      ? t('stocksprite.connections.form.credentials.sftp.usernameRequired')
      : '';
  const sftpPasswordPasswordError =
    touched && channel === 'SFTP' && sftpAuthType === 'PASSWORD' && !sftpPasswordPassword
      ? t('stocksprite.connections.form.credentials.sftp.passwordRequired')
      : '';
  const sftpKeyUsernameError =
    touched && channel === 'SFTP' && sftpAuthType === 'PRIVATE_KEY' && !sftpKeyUsername.trim()
      ? t('stocksprite.connections.form.credentials.sftp.usernameRequired')
      : '';
  const sftpPrivateKeyError =
    touched && channel === 'SFTP' && sftpAuthType === 'PRIVATE_KEY' && !sftpPrivateKey.trim()
      ? t('stocksprite.connections.form.credentials.sftp.privateKeyRequired')
      : '';

  const isCredentialsValid =
    channel === 'HTTP'
      ? httpAuthType === 'NONE'
        ? true
        : httpAuthType === 'BASIC'
        ? httpBasicUsername.trim().length > 0 && httpBasicPassword.length > 0
        : httpAuthType === 'BEARER'
        ? httpBearerToken.trim().length > 0
        : httpApiKeyHeaderName.trim().length > 0 && httpApiKeyHeaderValue.trim().length > 0
      : sftpAuthType === 'PASSWORD'
      ? sftpPasswordUsername.trim().length > 0 && sftpPasswordPassword.length > 0
      : sftpKeyUsername.trim().length > 0 && sftpPrivateKey.trim().length > 0;

  const isFormValid =
    name.trim().length > 0 &&
    name.length <= 255 &&
    (channel === 'HTTP'
      ? httpUrl.trim().length > 0 && (httpUrl.startsWith('http://') || httpUrl.startsWith('https://'))
      : sftpHost.trim().length > 0 && sftpRemoteDir.trim().length > 0) &&
    (dataFormat === 'CSV' ? csvDelimiter.length > 0 : xmlRowPath.trim().length > 0) &&
    isCredentialsValid;

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

      let credentialsPayload: ConnectionCredentials;
      if (channel === 'HTTP') {
        if (httpAuthType === 'NONE') {
          credentialsPayload = { authType: 'NONE' };
        } else if (httpAuthType === 'BASIC') {
          credentialsPayload = {
            authType: 'BASIC',
            username: httpBasicUsername.trim(),
            password: httpBasicPassword,
          };
        } else if (httpAuthType === 'BEARER') {
          credentialsPayload = {
            authType: 'BEARER',
            token: httpBearerToken.trim(),
          };
        } else {
          credentialsPayload = {
            authType: 'API_KEY',
            headerName: httpApiKeyHeaderName.trim(),
            headerValue: httpApiKeyHeaderValue.trim(),
          };
        }
      } else {
        if (sftpAuthType === 'PASSWORD') {
          credentialsPayload = {
            authType: 'PASSWORD',
            username: sftpPasswordUsername.trim(),
            password: sftpPasswordPassword,
          };
        } else {
          credentialsPayload = {
            authType: 'PRIVATE_KEY',
            username: sftpKeyUsername.trim(),
            privateKey: sftpPrivateKey.trim(),
            ...(sftpKeyPassphrase ? { passphrase: sftpKeyPassphrase } : {}),
          };
        }
      }

      const payload: ICreateConnectionPayload = {
        name: name.trim(),
        channel,
        dataFormat,
        isActive,
        config: configPayload,
        dataFormatConfig: dataFormatPayload,
        credentials: credentialsPayload,
      };

      await onSave(payload);
      setHasEditedSinceTest(false);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || t('stocksprite.connections.form.saveFailed'));
    }
  };

  const handleRunTest = async (): Promise<void> => {
    if (!initialConnection?.id) return;
    setTestError(null);
    setSubmitError(null);

    if (hasEditedSinceTest) {
      setSubmitError(t('stocksprite.connections.form.testing.savePromptBeforeTest'));
      return;
    }

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication token not available');

      setIsTestingRunning(true);
      setTestingProgress('start');
      await connectionService.runTest(token, initialConnection.id);
    } catch (err: unknown) {
      setIsTestingRunning(false);
      setTestingProgress('finish');
      setTestError((err as Error).message || t('stocksprite.connections.form.testing.failed'));
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

  const getProgressStatusText = (): string => {
    if (testingProgress === 'start') return t('stocksprite.connections.form.testing.start');
    if (testingProgress === 'download') return t('stocksprite.connections.form.testing.download');
    if (testingProgress === 'convert') return t('stocksprite.connections.form.testing.convert');
    return t('stocksprite.connections.form.testing.finish');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2 }}>
      {/* Top Header & Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onCancel}
            disabled={isTestingRunning}
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

        {/* Action Buttons in Top Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isEditing && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={isTestingRunning || !isEditing}
              onClick={() => setDeleteModalOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t('stocksprite.connections.form.buttons.delete')}
            </Button>
          )}

          {isEditing && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={isTestingRunning ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              disabled={!isFormValid || !isEditing || isTestingRunning}
              onClick={() => void handleRunTest()}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {isTestingRunning
                ? t('stocksprite.connections.form.buttons.testing')
                : t('stocksprite.connections.form.buttons.test')}
            </Button>
          )}

          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={saving || isTestingRunning}
            onClick={() => void handleSave()}
            sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}
          >
            {saving ? t('stocksprite.connections.form.buttons.saving') : t('stocksprite.connections.form.buttons.save')}
          </Button>
        </Box>
      </Box>

      {/* Global Alerts & Warnings */}
      {submitError && (
        <Alert severity="error" onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {testError && (
        <Alert severity="error" onClose={() => setTestError(null)}>
          {testError}
        </Alert>
      )}

      {/* Warning if user modified form settings while connection was tested */}
      {hasEditedSinceTest && (
        <Alert severity="warning">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('stocksprite.connections.form.testing.editedWarningTitle')}
          </Typography>
          <Typography variant="body2">
            {t('stocksprite.connections.form.testing.editedWarningMessage')}
          </Typography>
        </Alert>
      )}

      {/* Warning if user tries to activate untested / failed connection */}
      {isActive && (!testResult || testResult.success !== true) && (
        <Alert severity="warning">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('stocksprite.connections.form.testing.activationWarningTitle')}
          </Typography>
          <Typography variant="body2">
            {t('stocksprite.connections.form.testing.activationWarningMessage')}
          </Typography>
        </Alert>
      )}

      {/* Test Running Banner */}
      {isTestingRunning && (
        <Alert
          severity="info"
          icon={<CircularProgress size={20} />}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('stocksprite.connections.form.testing.inProgress')}
            </Typography>
            <Typography variant="body2">{getProgressStatusText()}</Typography>
          </Box>
        </Alert>
      )}

      {/* Test Results Display Card (Only if testResult exists and test not currently running) */}
      {testResult && !isTestingRunning && (
        <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {testResult.success ? (
                  <CheckCircleIcon color="success" sx={{ fontSize: 28 }} />
                ) : (
                  <ErrorIcon color="error" sx={{ fontSize: 28 }} />
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {testResult.success
                    ? t('stocksprite.connections.form.testing.success')
                    : t('stocksprite.connections.form.testing.failed')}
                </Typography>
              </Box>
              {testResult.finished_at && (
                <Typography variant="caption" color="text.secondary">
                  {t('stocksprite.connections.form.testing.testedAt')}: {new Date(testResult.finished_at).toLocaleString()}
                </Typography>
              )}
            </Box>

            {/* Error Message with Technical Details Accordion */}
            {testResult.success === false && testResult.errorMessage && (
              <Box sx={{ mt: 1 }}>
                <Alert severity="error" sx={{ mb: 1 }}>
                  {testResult.errorMessage.split('\n')[0]}
                </Alert>
                {testResult.errorMessage.includes('\n') && (
                  <Accordion variant="outlined" sx={{ borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.showDetails')}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography
                        component="pre"
                        sx={{
                          fontFamily: 'Consolas, Monaco, "Lucida Console", monospace',
                          fontSize: '0.8rem',
                          whiteSpace: 'pre-wrap',
                          overflowX: 'auto',
                          p: 1,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        {testResult.errorMessage}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            )}

            {/* Successful Result Metrics Grid */}
            {testResult.success === true && (
              <>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.duration')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.duration_ms !== undefined ? `${(testResult.duration_ms / 1000).toFixed(1)}s` : '-'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.rowCount')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.rowCount ?? 0}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.columnCount')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.columnCount ?? testResult.columns?.length ?? 0}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.fileSize')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.fileSize ? `${(testResult.fileSize / 1024).toFixed(1)} KB` : '-'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* 3 Sample Data Rows Preview Table */}
                {testResult.columns && testResult.columns.length > 0 && testResult.rows && testResult.rows.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {t('stocksprite.connections.form.testing.samplePreview')}
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            {testResult.columns.map((col, idx) => (
                              <TableCell key={idx} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {col}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {testResult.rows.slice(0, 3).map((row, rIdx) => (
                            <TableRow key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <TableCell key={cIdx} sx={{ whiteSpace: 'nowrap' }}>
                                  {cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('stocksprite.connections.form.testing.noDataRows')}
                  </Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Untested Notification */}
      {isEditing && !testResult && !isTestingRunning && (
        <Alert severity="info" icon={<HourglassEmptyIcon />}>
          {t('stocksprite.connections.form.testing.notTested')}
        </Alert>
      )}

      <Divider />

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
                name="connection_name"
                autoComplete="off"
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
                  name="http_url"
                  autoComplete="off"
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
                  <InputLabel id="http-method-label">{t('stocksprite.connections.form.http.method')}</InputLabel>
                  <Select
                    labelId="http-method-label"
                    id="http-method-select"
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
                  name="http_timeout"
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
                  name="sftp_host"
                  autoComplete="off"
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
                  name="sftp_port"
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
                  name="sftp_remote_dir"
                  autoComplete="off"
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
                  <InputLabel id="sftp-strategy-label">{t('stocksprite.connections.form.sftp.fileStrategy')}</InputLabel>
                  <Select
                    labelId="sftp-strategy-label"
                    id="sftp-strategy-select"
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

      {/* Dynamic Sub-Form: Authentication & Credentials */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('stocksprite.connections.form.credentials.title')}
            </Typography>
          </Box>

          {/* HTTP Credentials Sub-form */}
          {channel === 'HTTP' && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="http-auth-type-label">{t('stocksprite.connections.form.credentials.authType')}</InputLabel>
                  <Select
                    labelId="http-auth-type-label"
                    id="http-auth-type-select"
                    value={httpAuthType}
                    label={t('stocksprite.connections.form.credentials.authType')}
                    onChange={(e) => setHttpAuthType(e.target.value as HttpAuthType)}
                  >
                    <MenuItem value="NONE">{t('stocksprite.connections.form.credentials.http.none')}</MenuItem>
                    <MenuItem value="BASIC">{t('stocksprite.connections.form.credentials.http.basic')}</MenuItem>
                    <MenuItem value="BEARER">{t('stocksprite.connections.form.credentials.http.bearer')}</MenuItem>
                    <MenuItem value="API_KEY">{t('stocksprite.connections.form.credentials.http.apiKey')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {httpAuthType === 'BASIC' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_basic_username"
                      autoComplete="new-password"
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      label={t('stocksprite.connections.form.credentials.http.username')}
                      value={httpBasicUsername}
                      onChange={(e) => setHttpBasicUsername(e.target.value)}
                      error={Boolean(httpBasicUsernameError)}
                      helperText={httpBasicUsernameError}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_basic_password"
                      autoComplete="new-password"
                      type={showBasicPassword ? 'text' : 'password'}
                      label={t('stocksprite.connections.form.credentials.http.password')}
                      value={httpBasicPassword}
                      onChange={(e) => setHttpBasicPassword(e.target.value)}
                      error={Boolean(httpBasicPasswordError)}
                      helperText={httpBasicPasswordError}
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={
                                showBasicPassword
                                  ? t('stocksprite.connections.form.credentials.hide')
                                  : t('stocksprite.connections.form.credentials.show')
                              }
                              onClick={() => setShowBasicPassword(!showBasicPassword)}
                              edge="end"
                            >
                              {showBasicPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </>
              )}

              {httpAuthType === 'BEARER' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    name="ss_auth_bearer_token"
                    autoComplete="new-password"
                    type={showBearerToken ? 'text' : 'password'}
                    label={t('stocksprite.connections.form.credentials.http.token')}
                    placeholder={t('stocksprite.connections.form.credentials.http.tokenPlaceholder')}
                    value={httpBearerToken}
                    onChange={(e) => setHttpBearerToken(e.target.value)}
                    error={Boolean(httpBearerTokenError)}
                    helperText={httpBearerTokenError}
                    inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={
                              showBearerToken
                                ? t('stocksprite.connections.form.credentials.hide')
                                : t('stocksprite.connections.form.credentials.show')
                            }
                            onClick={() => setShowBearerToken(!showBearerToken)}
                            edge="end"
                          >
                            {showBearerToken ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              )}

              {httpAuthType === 'API_KEY' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_api_header_name"
                      autoComplete="off"
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'off' }}
                      label={t('stocksprite.connections.form.credentials.http.headerName')}
                      placeholder={t('stocksprite.connections.form.credentials.http.headerNamePlaceholder')}
                      value={httpApiKeyHeaderName}
                      onChange={(e) => setHttpApiKeyHeaderName(e.target.value)}
                      error={Boolean(httpApiKeyHeaderNameError)}
                      helperText={httpApiKeyHeaderNameError}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_api_header_value"
                      autoComplete="new-password"
                      type={showApiKeyValue ? 'text' : 'password'}
                      label={t('stocksprite.connections.form.credentials.http.headerValue')}
                      value={httpApiKeyHeaderValue}
                      onChange={(e) => setHttpApiKeyHeaderValue(e.target.value)}
                      error={Boolean(httpApiKeyHeaderValueError)}
                      helperText={httpApiKeyHeaderValueError}
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={
                                showApiKeyValue
                                  ? t('stocksprite.connections.form.credentials.hide')
                                  : t('stocksprite.connections.form.credentials.show')
                              }
                              onClick={() => setShowApiKeyValue(!showApiKeyValue)}
                              edge="end"
                            >
                              {showApiKeyValue ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          )}

          {/* SFTP Credentials Sub-form */}
          {channel === 'SFTP' && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="sftp-auth-type-label">{t('stocksprite.connections.form.credentials.authType')}</InputLabel>
                  <Select
                    labelId="sftp-auth-type-label"
                    id="sftp-auth-type-select"
                    value={sftpAuthType}
                    label={t('stocksprite.connections.form.credentials.authType')}
                    onChange={(e) => setSftpAuthType(e.target.value as SftpAuthType)}
                  >
                    <MenuItem value="PASSWORD">{t('stocksprite.connections.form.credentials.sftp.passwordAuth')}</MenuItem>
                    <MenuItem value="PRIVATE_KEY">{t('stocksprite.connections.form.credentials.sftp.sshKey')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {sftpAuthType === 'PASSWORD' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_sftp_username"
                      autoComplete="new-password"
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      label={t('stocksprite.connections.form.credentials.sftp.username')}
                      value={sftpPasswordUsername}
                      onChange={(e) => setSftpPasswordUsername(e.target.value)}
                      error={Boolean(sftpPasswordUsernameError)}
                      helperText={sftpPasswordUsernameError}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_sftp_password"
                      autoComplete="new-password"
                      type={showSftpPassword ? 'text' : 'password'}
                      label={t('stocksprite.connections.form.credentials.sftp.password')}
                      value={sftpPasswordPassword}
                      onChange={(e) => setSftpPasswordPassword(e.target.value)}
                      error={Boolean(sftpPasswordPasswordError)}
                      helperText={sftpPasswordPasswordError}
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={
                                showSftpPassword
                                  ? t('stocksprite.connections.form.credentials.hide')
                                  : t('stocksprite.connections.form.credentials.show')
                              }
                              onClick={() => setShowSftpPassword(!showSftpPassword)}
                              edge="end"
                            >
                              {showSftpPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </>
              )}

              {sftpAuthType === 'PRIVATE_KEY' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      name="ss_auth_sftp_key_username"
                      autoComplete="new-password"
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      label={t('stocksprite.connections.form.credentials.sftp.username')}
                      value={sftpKeyUsername}
                      onChange={(e) => setSftpKeyUsername(e.target.value)}
                      error={Boolean(sftpKeyUsernameError)}
                      helperText={sftpKeyUsernameError}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('stocksprite.connections.form.credentials.sftp.privateKey')} *
                      </Typography>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".pem,.key,.txt"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ textTransform: 'none' }}
                      >
                        {t('stocksprite.connections.form.credentials.sftp.chooseFile')}
                      </Button>
                    </Box>

                    <TextField
                      fullWidth
                      required
                      multiline
                      rows={5}
                      name="ss_auth_sftp_private_key"
                      autoComplete="off"
                      placeholder={t('stocksprite.connections.form.credentials.sftp.privateKeyPlaceholder')}
                      value={sftpPrivateKey}
                      onChange={(e) => setSftpPrivateKey(e.target.value)}
                      error={Boolean(sftpPrivateKeyError)}
                      helperText={sftpPrivateKeyError}
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true' }}
                      InputProps={{
                        sx: {
                          fontFamily: 'Consolas, Monaco, "Lucida Console", monospace',
                          fontSize: '0.85rem',
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="ss_auth_sftp_passphrase"
                      autoComplete="new-password"
                      type={showSftpPassphrase ? 'text' : 'password'}
                      label={t('stocksprite.connections.form.credentials.sftp.passphrase')}
                      value={sftpKeyPassphrase}
                      onChange={(e) => setSftpKeyPassphrase(e.target.value)}
                      helperText={t('stocksprite.connections.form.credentials.sftp.passphraseHelper')}
                      inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true', autoComplete: 'new-password' }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={
                                showSftpPassphrase
                                  ? t('stocksprite.connections.form.credentials.hide')
                                  : t('stocksprite.connections.form.credentials.show')
                              }
                              onClick={() => setShowSftpPassphrase(!showSftpPassphrase)}
                              edge="end"
                            >
                              {showSftpPassphrase ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </>
              )}
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
            <InputLabel id="data-format-label">{t('stocksprite.connections.form.dataFormat')}</InputLabel>
            <Select
              labelId="data-format-label"
              id="data-format-select"
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
                  <InputLabel id="csv-delimiter-label">{t('stocksprite.connections.form.csv.delimiter')}</InputLabel>
                  <Select
                    labelId="csv-delimiter-label"
                    id="csv-delimiter-select"
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
                  <InputLabel id="csv-encoding-label">{t('stocksprite.connections.form.csv.encoding')}</InputLabel>
                  <Select
                    labelId="csv-encoding-label"
                    id="csv-encoding-select"
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
                  name="xml_row_path"
                  autoComplete="off"
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
                  name="xml_attribute_prefix"
                  autoComplete="off"
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
