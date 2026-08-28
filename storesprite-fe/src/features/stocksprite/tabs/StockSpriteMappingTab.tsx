import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import ToastNotification from '../../../components/ToastNotification.js';
import type { IMappingService } from '../../../types/MappingService.interface.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type { IMapping, ICreateMappingPayload } from '../../../types/Mapping.interface.js';
import type { IDataConnection } from '../../../types/DataConnection.interface.js';
import MappingList from '../mappings/MappingList.js';
import MappingForm from '../mappings/MappingForm.js';

type ViewMode = 'LIST' | 'ADD' | 'EDIT';

export default function StockSpriteMappingTab(): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken } = useAuth();
  const mappingService = useInjection<IMappingService>(TYPES.IMappingService);
  const connectionService = useInjection<IConnectionService>(TYPES.IConnectionService);

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [mappings, setMappings] = useState<IMapping[]>([]);
  const [connections, setConnections] = useState<IDataConnection[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<IMapping | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const [mappingsResponse, connectionsResponse] = await Promise.all([
        mappingService.getMappings(token),
        connectionService.getConnections(token),
      ]);
      setMappings(mappingsResponse.mappings ?? []);
      setConnections(connectionsResponse.connections ?? []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, [mappingService, connectionService, getToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAddNew = (): void => {
    setSelectedMapping(null);
    setViewMode('ADD');
  };

  const handleSelectMapping = (mapping: IMapping): void => {
    setSelectedMapping(mapping);
    setViewMode('EDIT');
  };

  const handleCancel = (): void => {
    setSelectedMapping(null);
    setViewMode('LIST');
  };

  const handleCloseSnackbar = (): void => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSave = async (payload: ICreateMappingPayload): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      let savedMapping: IMapping | null = null;
      if (viewMode === 'EDIT' && selectedMapping?.id) {
        const response = await mappingService.updateMapping(token, selectedMapping.id, payload);
        savedMapping = response.mapping ?? null;
      } else {
        const response = await mappingService.createMapping(token, payload);
        savedMapping = response.mapping ?? null;
      }

      setSnackbar({
        open: true,
        message: t('stocksprite.mappings.form.savedSuccess'),
        severity: 'success',
      });
      if (savedMapping) {
        setSelectedMapping(savedMapping);
        setViewMode('EDIT');
      } else {
        setSelectedMapping(null);
        setViewMode('LIST');
      }

      try {
        const listResponse = await mappingService.getMappings(token);
        setMappings(listResponse.mappings ?? []);
        if (savedMapping) {
          const fresh = (listResponse.mappings ?? []).find((m) => m.id === savedMapping?.id);
          if (fresh) {
            setSelectedMapping(fresh);
          }
        }
      } catch {
        // Silently ignore background list refresh error if save succeeded
      }
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.mappings.form.saveFailed'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      await mappingService.deleteMapping(token, id);
      setSnackbar({
        open: true,
        message: t('stocksprite.mappings.form.deleteSuccess'),
        severity: 'success',
      });
      setViewMode('LIST');
      setSelectedMapping(null);
      await fetchData();
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.mappings.form.deleteFailed'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {viewMode === 'LIST' ? (
        <MappingList mappings={mappings} onAddNew={handleAddNew} onSelectMapping={handleSelectMapping} />
      ) : (
        <MappingForm
          initialMapping={selectedMapping}
          connections={connections}
          mappings={mappings}
          onSave={handleSave}
          onDelete={viewMode === 'EDIT' ? handleDelete : undefined}
          onCancel={handleCancel}
          saving={saving}
        />
      )}

      <ToastNotification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />
    </Box>
  );
}
