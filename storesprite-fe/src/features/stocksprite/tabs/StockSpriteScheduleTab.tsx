import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chip } from '@mui/material';
import { useAuth } from '@clerk/clerk-react';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import EntityList from '../EntityList.js';
import { useTabController } from '../useTabController.js';
import ScheduleForm from '../schedule/ScheduleForm.js';
import type { IMappingService } from '../../../types/MappingService.interface.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type { IMapping, IMappingSchedule } from '../../../types/Mapping.interface.js';
import type { IDataConnection } from '../../../types/DataConnection.interface.js';

export default function StockSpriteScheduleTab(): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken } = useAuth();
  const mappingService = useInjection<IMappingService>(TYPES.IMappingService);
  const connectionService = useInjection<IConnectionService>(TYPES.IConnectionService);

  const [mappings, setMappings] = useState<IMapping[]>([]);
  const [connections, setConnections] = useState<IDataConnection[]>([]);

  const {
    selected,
    saving,
    setViewMode,
    setSelected,
    setLoading,
    setSaving,
    setError,
    setSnackbar,
    handleAddNew,
    handleSelect,
    handleCancel,
    renderContent,
  } = useTabController<IMapping>();

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
  }, [mappingService, connectionService, getToken, setLoading, setError]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const schedules = useMemo(() => mappings.filter((m) => m.schedule != null), [mappings]);

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
        setSelected(savedMapping);
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
      setSelected(null);
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

  return renderContent(
    <EntityList
      title={t('stocksprite.schedule.title')}
      subtitle={t('stocksprite.schedule.subtitle')}
      addLabel={t('stocksprite.schedule.addSchedule')}
      emptyLabel={t('stocksprite.schedule.empty')}
      icon={<ScheduleIcon color="primary" />}
      nameHeader={t('stocksprite.schedule.name')}
      items={schedules}
      onAdd={handleAddNew}
      onSelect={handleSelect}
      getKey={(m) => m.id}
      getName={(m) => m.name}
      extraColumns={[
        {
          header: t('stocksprite.schedule.enabled'),
          render: (m) => (
            <Chip size="small" color={m.scheduleEnabled ? 'success' : 'default'} label={m.scheduleEnabled ? t('common.enabled') : t('common.disabled')} />
          ),
        },
      ]}
    />,
    <ScheduleForm
      initialMapping={selected}
      connections={connections}
      mappings={mappings}
      onSave={handleSave}
      onDelete={handleDelete}
      onRun={handleRun}
      onCancel={handleCancel}
      saving={saving}
    />
  );
}
