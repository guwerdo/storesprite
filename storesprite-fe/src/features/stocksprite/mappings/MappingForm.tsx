import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  FormHelperText,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IDataConnection } from '../../../types/stocksprite/DataConnection.interface.js';
import type { IMapping, IMappingRuleDefinition, ICreateMappingPayload } from '../../../types/stocksprite/Mapping.interface.js';
import type { IWarehouse } from '../../../types/unas/UnasConnection.interface.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { IUnasService } from '../../../types/unas/UnasService.interface.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';
import StockMappingsSection from './components/StockMappingsSection.js';
import RulesEditor from './components/RulesEditor.js';
import {
  createMappingFormSchema,
  MappingFormValues,
} from './schema/mappingFormSchema.js';
import { toApiPayload, toFormValues } from './schema/mappingFormTransformers.js';

export interface MappingFormProps {
  initialMapping: IMapping | null;
  connections: IDataConnection[];
  mappings: IMapping[];
  onSave: (payload: ICreateMappingPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function MappingForm({
  initialMapping,
  connections,
  mappings,
  onSave,
  onDelete,
  onCancel,
  saving = false,
}: MappingFormProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken } = useAuth();
  const mappingService = useInjection<IMappingService>(TYPES.IMappingService);
  const unasService = useInjection<IUnasService>(TYPES.IUnasService);

  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [rulesDict, setRulesDict] = useState<IMappingRuleDefinition[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

  const schema = useMemo(() => createMappingFormSchema(t), [t]);
  const defaultValues = useMemo(() => toFormValues(initialMapping), [initialMapping]);

  const methods = useForm<MappingFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues,
  });

  const { control, handleSubmit, reset, watch, formState } = methods;
  const connectionId = watch('connectionId');

  useEffect(() => {
    reset(toFormValues(initialMapping));
  }, [initialMapping, reset]);

  useEffect(() => {
    let mounted = true;
    const loadOptions = async (): Promise<void> => {
      const token = await getToken();
      if (!token) return;

      try {
        const [warehouseResponse, rulesResponse] = await Promise.all([
          unasService.getWarehouses(token),
          mappingService.getRules(token),
        ]);
        if (mounted) {
          setWarehouses(warehouseResponse.warehouses ?? []);
          setRulesDict(rulesResponse.rules ?? []);
        }
      } catch {
        if (mounted) {
          setWarehouses([]);
          setRulesDict([]);
        }
      }
    };
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, [unasService, mappingService, getToken]);

  const selectedConnection = connections.find((c) => c.id === connectionId);
  const isTestedConnection =
    !!selectedConnection &&
    selectedConnection.testResult?.success === true &&
    (selectedConnection.testResult.columns?.length ?? 0) > 0;

  const selectableConnections = useMemo(
    () => {
      const mappedConnectionIds = new Set(
        mappings.filter((m) => m.id !== initialMapping?.id).map((m) => m.connectionId)
      );
      return connections.filter((c) => !mappedConnectionIds.has(c.id));
    },
    [connections, mappings, initialMapping]
  );

  const onSubmit = (values: MappingFormValues): void => {
    void onSave(toApiPayload(values, rulesDict));
  };

  const handleDeleteConfirm = (): void => {
    setDeleteModalOpen(false);
    if (onDelete && initialMapping?.id) {
      void onDelete(initialMapping.id);
    }
  };

  const isEditing = !!initialMapping?.id;

  return (
    <FormProvider {...methods}>
      <Box component="form" noValidate onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={onCancel} sx={{ textTransform: 'none' }}>
            {t('stocksprite.mappings.form.buttons.backToList')}
          </Button>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {isEditing ? t('stocksprite.mappings.form.editTitle') : t('stocksprite.mappings.form.addTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('stocksprite.mappings.form.subtitle')}
            </Typography>
          </Box>
        </Box>

        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <TextField
                label={t('stocksprite.mappings.form.name')}
                sx={{ minWidth: 260, flexGrow: 1 }}
                error={!!formState.errors.name}
                helperText={formState.errors.name?.message}
                {...methods.register('name')}
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="mapping-connection-label">{t('stocksprite.mappings.form.connection')}</InputLabel>
                <Controller
                  name="connectionId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      labelId="mapping-connection-label"
                      label={t('stocksprite.mappings.form.connection')}
                      error={!!formState.errors.connectionId}
                      disabled={connections.length === 0}
                      {...field}
                    >
                      {connections.length === 0 && (
                        <MenuItem value="" disabled>
                          {t('stocksprite.mappings.form.connectionUnavailable')}
                        </MenuItem>
                      )}
                      {selectableConnections.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {formState.errors.connectionId && (
                  <FormHelperText error>{formState.errors.connectionId.message}</FormHelperText>
                )}
              </FormControl>

              {connections.length === 0 && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1.5, borderRadius: '8px' }}>
                  {t('stocksprite.mappings.form.connectionUnavailable')}
                </Alert>
              )}

              {connections.length > 0 && selectableConnections.length === 0 && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1.5, borderRadius: '8px' }}>
                  {t('stocksprite.mappings.form.noTestedConnections')}
                </Alert>
              )}

              {connectionId && !isTestedConnection && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1.5, borderRadius: '8px' }}>
                  {t('stocksprite.mappings.form.connectionNotTested')}
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>

        {isTestedConnection && (
          <>
            <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('stocksprite.mappings.form.skuTitle')}
                </Typography>
                <FormControl fullWidth sx={{ mb: 1 }}>
                  <InputLabel id="mapping-sku-label">{t('stocksprite.mappings.form.skuLabel')}</InputLabel>
                  <Controller
                    name="skuField"
                    control={control}
                    render={({ field }) => (
                      <Select
                        labelId="mapping-sku-label"
                        label={t('stocksprite.mappings.form.skuLabel')}
                        error={!!formState.errors.skuField}
                        {...field}
                      >
                        {(selectedConnection?.testResult?.columns ?? []).map((c) => (
                          <MenuItem key={c} value={c}>
                            {c}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  {formState.errors.skuField && (
                    <FormHelperText error>{formState.errors.skuField.message}</FormHelperText>
                  )}
                </FormControl>

                <RulesEditor name="skuRules" group="sku" rulesDict={rulesDict} sample="part no" />
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {t('stocksprite.mappings.form.stockMappingTitle')}
                  </Typography>
                </Box>

                <StockMappingsSection
                  columns={selectedConnection?.testResult?.columns ?? []}
                  warehouses={warehouses}
                  rulesDict={rulesDict}
                />

                {warehouses.length === 0 && (
                  <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2, borderRadius: '8px' }}>
                    {t('stocksprite.mappings.form.warehouseEmpty')}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Box>
            {isEditing && onDelete && (
              <Button
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteModalOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                {t('stocksprite.mappings.form.buttons.delete')}
              </Button>
            )}
          </Box>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            disabled={saving}
            sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
          >
            {saving ? t('stocksprite.mappings.form.buttons.saving') : t('stocksprite.mappings.form.buttons.save')}
          </Button>
        </Box>

        <ConfirmDialog
          open={deleteModalOpen}
          title={t('stocksprite.mappings.form.deleteModal.title')}
          description={t('stocksprite.mappings.form.deleteModal.prompt')}
          confirmLabel={t('stocksprite.mappings.form.deleteModal.yes')}
          cancelLabel={t('stocksprite.mappings.form.deleteModal.no')}
          destructive
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModalOpen(false)}
        />
      </Box>
    </FormProvider>
  );
}
