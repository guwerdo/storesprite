import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import ToastNotification from '../../../components/ToastNotification.js';
import type { IConnectionService } from '../../../types/ConnectionService.interface.js';
import type {
  IDataConnection,
  ICreateConnectionPayload,
} from '../../../types/DataConnection.interface.js';
import ConnectionList from '../connections/ConnectionList.js';
import ConnectionForm from '../connections/ConnectionForm.js';

type ViewMode = 'LIST' | 'ADD' | 'EDIT';

export default function StockSpriteConnectionsTab(): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken } = useAuth();
  const connectionService = useInjection<IConnectionService>(TYPES.IConnectionService);

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [connections, setConnections] = useState<IDataConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<IDataConnection | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

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
  }, [connectionService, getToken]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const handleAddNew = (): void => {
    setSelectedConnection(null);
    setViewMode('ADD');
  };

  const handleSelectConnection = (connection: IDataConnection): void => {
    setSelectedConnection(connection);
    setViewMode('EDIT');
  };

  const handleCancel = (): void => {
    setSelectedConnection(null);
    setViewMode('LIST');
  };

  const handleCloseSnackbar = (): void => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSave = async (payload: ICreateConnectionPayload): Promise<void> => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      if (viewMode === 'EDIT' && selectedConnection?.id) {
        await connectionService.updateConnection(token, selectedConnection.id, payload);
      } else {
        await connectionService.createConnection(token, payload);
      }

      setSnackbar({
        open: true,
        message: t('stocksprite.connections.form.savedSuccess'),
        severity: 'success',
      });
      setViewMode('LIST');
      setSelectedConnection(null);
      await fetchConnections();
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
      setSelectedConnection(null);
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
        <ConnectionList
          connections={connections}
          onAddNew={handleAddNew}
          onSelectConnection={handleSelectConnection}
        />
      ) : (
        <ConnectionForm
          initialConnection={selectedConnection}
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
