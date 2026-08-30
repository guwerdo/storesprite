import React, { useCallback, useEffect, useState } from 'react';
import { Chip } from '@mui/material';
import { useAuth } from '@clerk/clerk-react';
import CableIcon from '@mui/icons-material/Cable';
import LanguageIcon from '@mui/icons-material/Language';
import StorageIcon from '@mui/icons-material/Storage';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import EntityList from '../EntityList.js';
import { useTabController } from '../useTabController.js';
import ConnectionForm from '../connections/ConnectionForm.js';
import { getConnectionStatus } from '../connections/connectionStatus.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type { IDataConnection, ICreateConnectionPayload } from '../../../types/DataConnection.interface.js';

interface StatusBadge {
  label: string;
  color: 'warning' | 'success' | 'info' | 'error' | 'default';
}

export default function StockSpriteConnectionsTab(): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken } = useAuth();
  const connectionService = useInjection<IConnectionService>(TYPES.IConnectionService);

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
  } = useTabController<IDataConnection>();

  const fetchConnections = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await connectionService.getConnections(token);
      setConnections(response.connections || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load data connections');
    } finally {
      setLoading(false);
    }
  }, [connectionService, getToken, setLoading, setError]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const getStatusBadge = (conn: IDataConnection): StatusBadge => {
    switch (getConnectionStatus(conn)) {
      case 'active':
        return { label: t('stocksprite.connections.form.statusBadges.active'), color: 'success' };
      case 'activeTesting':
        return { label: t('stocksprite.connections.form.statusBadges.activeTesting'), color: 'warning' };
      case 'inactiveTesting':
        return { label: t('stocksprite.connections.form.statusBadges.inactiveTesting'), color: 'warning' };
      case 'inactive':
        return { label: t('stocksprite.connections.form.statusBadges.inactive'), color: 'info' };
      case 'error':
        return { label: t('stocksprite.connections.form.statusBadges.inactiveError'), color: 'error' };
      case 'untested':
        return { label: t('stocksprite.connections.form.statusBadges.inactiveUntested'), color: 'default' };
    }
  };

  const handleSave = async (payload: ICreateConnectionPayload): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      let savedConnection: IDataConnection | null = null;
      if (viewMode === 'EDIT' && selected?.id) {
        const response = await connectionService.updateConnection(token, selected.id, payload);
        savedConnection = response.connection ?? null;
      } else {
        const response = await connectionService.createConnection(token, payload);
        savedConnection = response.connection ?? null;
      }

      setSnackbar({
        open: true,
        message: t('stocksprite.connections.form.savedSuccess'),
        severity: 'success',
      });
      if (savedConnection) {
        setSelected(savedConnection);
        setViewMode('EDIT');
      } else {
        setSelected(null);
        setViewMode('LIST');
      }
      // Refresh connections list in the background without triggering full tab loading spinner
      try {
        const listResponse = await connectionService.getConnections(token);
        setConnections(listResponse.connections || []);
        if (savedConnection) {
          const fresh = (listResponse.connections || []).find((c) => c.id === savedConnection.id);
          if (fresh) {
            setSelected(fresh);
          }
        }
      } catch {
        // Silently ignore background list refresh error if save succeeded
      }
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.connections.form.saveFailed'),
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

      await connectionService.deleteConnection(token, id);
      setSnackbar({
        open: true,
        message: t('stocksprite.connections.form.deleteSuccess'),
        severity: 'success',
      });
      setViewMode('LIST');
      setSelected(null);
      await fetchConnections();
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: (err as Error).message || t('stocksprite.connections.form.deleteFailed'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return renderContent(
    <EntityList
      title={t('stocksprite.tabs.connections')}
      subtitle={t('stocksprite.connections.form.subtitle')}
      addLabel={t('stocksprite.connections.addNew')}
      emptyLabel={t('stocksprite.connections.empty')}
      icon={<CableIcon color="primary" />}
      nameHeader={t('stocksprite.connections.table.name')}
      items={connections}
      onAdd={handleAddNew}
      onSelect={handleSelect}
      getKey={(c) => c.id}
      getName={(c) => c.name}
      extraColumns={[
        {
          header: t('stocksprite.connections.table.channel'),
          render: (conn) => (
            <Chip
              size="small"
              icon={conn.channel === 'HTTP' ? <LanguageIcon fontSize="small" /> : <StorageIcon fontSize="small" />}
              label={conn.channel}
              color={conn.channel === 'HTTP' ? 'info' : 'secondary'}
              variant="outlined"
            />
          ),
        },
        {
          header: t('stocksprite.connections.table.format'),
          render: (conn) => (
            <Chip size="small" label={conn.dataFormat} color={conn.dataFormat === 'CSV' ? 'success' : 'warning'} variant="outlined" />
          ),
        },
        {
          header: t('stocksprite.connections.table.status'),
          render: (conn) => {
            const badge = getStatusBadge(conn);
            return <Chip size="small" label={badge.label} color={badge.color} />;
          },
        },
      ]}
    />,
    <ConnectionForm
      initialConnection={selected}
      onSave={handleSave}
      onDelete={viewMode === 'EDIT' ? handleDelete : undefined}
      onCancel={handleCancel}
      saving={saving}
    />
  );
}
