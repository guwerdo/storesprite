import React, { useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import ToastNotification from '../../components/ToastNotification.js';

export type TabViewMode = 'LIST' | 'ADD' | 'EDIT';

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

/**
 * Shared state machine + render skeleton for the StockSprite list/add/edit tabs.
 * Each tab supplies its own fetch/save/delete logic; this hook owns the
 * navigation state, loading/saving/error/snackbar state, and the layout shell.
 */
export function useTabController<T>() {
  const [viewMode, setViewMode] = useState<TabViewMode>('LIST');
  const [selected, setSelected] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });

  const handleAddNew = (): void => {
    setSelected(null);
    setViewMode('ADD');
  };

  const handleSelect = (item: T): void => {
    setSelected(item);
    setViewMode('EDIT');
  };

  const handleCancel = (): void => {
    setSelected(null);
    setViewMode('LIST');
  };

  const handleCloseSnackbar = (): void => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const renderContent = (list: React.ReactNode, form: React.ReactNode): React.JSX.Element => {
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
        {viewMode === 'LIST' ? list : form}
        <ToastNotification
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={handleCloseSnackbar}
        />
      </Box>
    );
  };

  return {
    viewMode,
    selected,
    loading,
    saving,
    error,
    snackbar,
    setViewMode,
    setSelected,
    setLoading,
    setSaving,
    setError,
    setSnackbar,
    handleAddNew,
    handleSelect,
    handleCancel,
    handleCloseSnackbar,
    renderContent,
  };
}
