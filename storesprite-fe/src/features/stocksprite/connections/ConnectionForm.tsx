import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Grid,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type { ISocketService } from '../../../types/SocketService.interface.js';
import type {
  IDataConnection,
  ICreateConnectionPayload,
  ConnectionTestResult,
  ConnectionTestProgress,
} from '../../../types/DataConnection.interface.js';
import {
  type ConnectionFormValues,
  createConnectionFormSchema,
} from './schema/connectionFormSchema.js';
import {
  toFormValues,
  toApiPayload,
} from './schema/connectionFormTransformers.js';
import { ChannelConfigSection } from './components/ChannelConfigSection.js';
import { DataFormatConfigSection } from './components/DataFormatConfigSection.js';
import { CredentialsSection } from './components/CredentialsSection.js';
import { ConnectionTestPane } from './components/ConnectionTestPane.js';
import { CannotActivateDialog } from './components/CannotActivateDialog.js';
import { isInProgress, TEST_RUN_TIMEOUT_MS } from './connectionStatus.js';

export interface ConnectionFormProps {
  initialConnection?: IDataConnection | null;
  onSave: (payload: ICreateConnectionPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

function isTestRunning(connection: IDataConnection | null | undefined): boolean {
  const testResult = connection?.testResult;
  if (!isInProgress(testResult?.progress)) return false;
  const startedAt = testResult.started_at ? new Date(testResult.started_at).getTime() : 0;
  // If more than 15 minutes have passed since started_at, consider it timed out / not running
  return startedAt === 0 || Date.now() - startedAt <= TEST_RUN_TIMEOUT_MS;
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
  const connectionId = initialConnection?.id;

  // Form State via React Hook Form & Zod
  const schema = useMemo(() => createConnectionFormSchema(t), [t]);
  const defaultValues = useMemo(() => toFormValues(initialConnection), [initialConnection]);
  const methods = useForm<ConnectionFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = methods;

  // Testing & TestResult State
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    initialConnection?.testResult ?? null
  );
  const [testingProgress, setTestingProgress] = useState<ConnectionTestProgress>(
    initialConnection?.testResult?.progress ?? null
  );
  const [isTestingRunning, setIsTestingRunning] = useState<boolean>(() =>
    isTestRunning(initialConnection)
  );
  const [testError, setTestError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Modal Dialogs
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [activationWarningModalOpen, setActivationWarningModalOpen] = useState(false);

  // Synchronize internal state whenever initialConnection prop changes (e.g. after save)
  useEffect(() => {
    if (!initialConnection) return;
    reset(toFormValues(initialConnection));
    setTestResult(initialConnection.testResult ?? null);
    setTestingProgress(initialConnection.testResult?.progress ?? null);
    setIsTestingRunning(isTestRunning(initialConnection));
  }, [initialConnection, reset]);

  // Socket.IO real-time progress subscription
  useEffect(() => {
    if (clerkUserId) {
      socketService.connect(clerkUserId);
    }

    const onProgress = (data: { connectionId: string; progress: ConnectionTestProgress }): void => {
      if (connectionId && data.connectionId === connectionId) {
        setTestingProgress(data.progress);
        if (isInProgress(data.progress)) {
          setIsTestingRunning(true);
        }
      }
    };

    const onResult = (data: { connectionId: string; testResult: ConnectionTestResult }): void => {
      if (connectionId && data.connectionId === connectionId) {
        setTestResult(data.testResult);
        setTestingProgress(data.testResult.progress ?? null);
        setIsTestingRunning(false);
      }
    };

    const onInvalidated = (data: { connectionId: string }): void => {
      if (connectionId && data.connectionId === connectionId) {
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
  }, [clerkUserId, connectionId, socketService]);

  // 15-minute fallback timeout for running test
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isTestingRunning) {
      timer = setTimeout(() => {
        setIsTestingRunning(false);
        setTestingProgress('finish');
        setTestError(t('stocksprite.connections.form.testing.timeout'));
      }, TEST_RUN_TIMEOUT_MS);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isTestingRunning, t]);

  // Only connection-setting edits (channel, config, format, credentials) invalidate the last
  // test result; editing the name or toggling isActive does not.
  const hasConnectionSettingsChanged = Object.keys(dirtyFields).some(
    (field) => field !== 'name' && field !== 'isActive'
  );

  const hasEditedSinceTest = Boolean(hasConnectionSettingsChanged && testResult);

  const onSubmit = async (values: ConnectionFormValues): Promise<void> => {
    setSubmitError(null);
    try {
      const payload = toApiPayload(values);
      await onSave(payload);
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

  return (
    <FormProvider {...methods}>
      <Box
        component="form"
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}
      >
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
                  autoComplete="off"
                  label={t('stocksprite.connections.form.name')}
                  placeholder={t('stocksprite.connections.form.namePlaceholder')}
                  {...register('name')}
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message || 'Max 255 characters'}
                />
              </Grid>

              {/* Active Switch with Invariant Guard */}
              <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(e) => {
                            const nextValue = e.target.checked;
                            if (nextValue && (!testResult || testResult.success !== true)) {
                              setActivationWarningModalOpen(true);
                              field.onChange(false);
                              return;
                            }
                            field.onChange(nextValue);
                          }}
                          color="primary"
                        />
                      }
                      label={t('stocksprite.connections.form.isActive')}
                    />
                  )}
                />
                <FormHelperText>{t('stocksprite.connections.form.isActiveHelper')}</FormHelperText>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Transport Channel Config Section */}
        <ChannelConfigSection />

        {/* Credentials Config Section (Authentication & Credentials directly below Transport Configuration) */}
        <CredentialsSection />

        {/* Data Format Parser Config Section */}
        <DataFormatConfigSection />

        {/* Bottom Actions Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isEditing && onDelete && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteModalOpen(true)}
                disabled={saving || isTestingRunning}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {t('stocksprite.connections.form.buttons.delete')}
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {isEditing && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={isTestingRunning ? <CircularProgress size={18} /> : <PlayArrowIcon />}
                onClick={() => void handleRunTest()}
                disabled={saving || isTestingRunning}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {isTestingRunning
                  ? t('stocksprite.connections.form.testing.testingInProgress')
                  : t('stocksprite.connections.form.buttons.testConnection')}
              </Button>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              disabled={saving || isTestingRunning || (!isDirty && !isEditing)}
              sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
            >
              {saving
                ? t('stocksprite.connections.form.buttons.saving')
                : t('stocksprite.connections.form.buttons.save')}
            </Button>
          </Box>
        </Box>

        {/* Connection Testing Pane (Placed below Action Buttons) */}
        {isEditing && (
          <ConnectionTestPane
            testResult={testResult}
            testingProgress={testingProgress}
            isTestingRunning={isTestingRunning}
          />
        )}

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

        {/* Cannot Activate Untested Connection Warning Dialog */}
        <CannotActivateDialog
          open={activationWarningModalOpen}
          onClose={() => setActivationWarningModalOpen(false)}
        />
      </Box>
    </FormProvider>
  );
}
