import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';

export interface CannotActivateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CannotActivateDialog({ open, onClose }: CannotActivateDialogProps): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="activation-warning-dialog-title"
      aria-describedby="activation-warning-dialog-description"
    >
      <DialogTitle id="activation-warning-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        {t('stocksprite.connections.form.testing.activationWarningTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="activation-warning-dialog-description">
          {t('stocksprite.connections.form.testing.activationWarningMessage')}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          color="primary"
          variant="contained"
          autoFocus
          sx={{ textTransform: 'none', px: 3 }}
        >
          {t('common.ok') || 'OK'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
