import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import SchemaIcon from '@mui/icons-material/Schema';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import EntityList from '../EntityList.js';
import { useTabController } from '../useTabController.js';
import MappingForm from '../mappings/MappingForm.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { IConnectionService } from '../../../types/stocksprite/ConnectionService.interface.js';
import type { IMapping, ICreateMappingPayload } from '../../../types/stocksprite/Mapping.interface.js';
import type { IDataConnection } from '../../../types/stocksprite/DataConnection.interface.js';

export default function StockSpriteMappingTab(): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken } = useAuth();
  const mappingService = useInjection<IMappingService>(TYPES.IMappingService);
  const connectionService = useInjection<IConnectionService>(TYPES.IConnectionService);

  const [mappings, setMappings] = useState<IMapping[]>([]);
  const [connections, setConnections] = useState<IDataConnection[]>([]);

  const {
    viewMode,
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
      setError((err as Error).message || 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, [mappingService, connectionService, getToken, setLoading, setError]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSave = async (payload: ICreateMappingPayload): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      let savedMapping: IMapping | null = null;
      if (viewMode === 'EDIT' && selected?.id) {
        const response = await mappingService.updateMapping(token, selected.id, payload);
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
        setSelected(savedMapping);
        setViewMode('EDIT');
        setMappings((prev) =>
          prev.some((m) => m.id === savedMapping.id)
            ? prev.map((m) => (m.id === savedMapping.id ? savedMapping : m))
            : [savedMapping, ...prev]
        );
      } else {
        setSelected(null);
        setViewMode('LIST');
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
      setSelected(null);
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

  return renderContent(
    <EntityList
      title={t('stocksprite.mappings.title')}
      subtitle={t('stocksprite.mappings.subtitle')}
      addLabel={t('stocksprite.mappings.addMapping')}
      emptyLabel={t('stocksprite.mappings.empty')}
      icon={<SchemaIcon color="primary" />}
      nameHeader={t('stocksprite.mappings.table.name')}
      items={mappings}
      onAdd={handleAddNew}
      onSelect={handleSelect}
      getKey={(m) => m.id}
      getName={(m) => m.name}
    />,
    <MappingForm
      initialMapping={selected}
      connections={connections}
      mappings={mappings}
      onSave={handleSave}
      onDelete={viewMode === 'EDIT' ? handleDelete : undefined}
      onCancel={handleCancel}
      saving={saving}
    />
  );
}
