import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import ToastNotification from '../../../components/ToastNotification.js';
import type { IMappingService } from '../../../types/MappingService.interface.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type { IMapping, IMappingSchedule } from '../../../types/Mapping.interface.js';
import type { IDataConnection } from '../../../types/DataConnection.interface.js';
import ScheduleList from '../schedule/ScheduleList.js';
import ScheduleForm from '../schedule/ScheduleForm.js';

type ViewMode = 'LIST' | 'ADD' | 'EDIT';

export default function StockSpriteScheduleTab(): React.JSX.Element {
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
      setError((err as Error).message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [mappingService, connectionService, getToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const schedules = useMemo(() => mappings.filter((m) => m.schedule != null), [mappings]);

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

  const handleSave = async (
    mappingId: string,
    payload: { scheduleEnabled: boolean; schedule: IMappingSchedule }
  ): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }
      const response = await mappingService.updateMapping(token, mappingId, payload);
      const savedMapping = response.mapping ?? null;
      setSnackbar({ open: true, message: t('stocksprite.schedule.savedSuccess'), severity: 'success' });
      if (savedMapping) {
        setSelectedMapping(savedMapping);
        setViewMode('EDIT');
        setMappings((prev) =>
          prev.some((m) => m.id === savedMapping.id)
            ? prev.map((m) => (m.id === savedMapping.id ? savedMapping : m))
            : [savedMapping, ...prev]
        );
      }
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.schedule.saveFailed'),
        severity: 'error',
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mappingId: string): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }
      const response = await mappingService.updateMapping(token, mappingId, { scheduleEnabled: false, schedule: null });
      const clearedMapping = response.mapping ?? null;
      setSnackbar({ open: true, message: t('stocksprite.schedule.deleteSuccess'), severity: 'success' });
      if (clearedMapping) {
        setMappings((prev) => prev.map((m) => (m.id === clearedMapping.id ? clearedMapping : m)));
      }
      setViewMode('LIST');
      setSelectedMapping(null);
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.schedule.deleteFailed'),
        severity: 'error',
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (mappingId: string): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }
      await mappingService.runMapping(token, mappingId);
      setSnackbar({ open: true, message: t('stocksprite.schedule.runTriggered'), severity: 'success' });
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.schedule.runFailed'),
        severity: 'error',
      });
      throw err;
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
        <ScheduleList schedules={schedules} onAddNew={handleAddNew} onSelectMapping={handleSelectMapping} />
      ) : (
        <ScheduleForm
          initialMapping={selectedMapping}
          connections={connections}
          mappings={mappings}
          onSave={handleSave}
          onDelete={handleDelete}
          onRun={handleRun}
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
