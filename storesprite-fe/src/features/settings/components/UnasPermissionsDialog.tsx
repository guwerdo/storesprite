import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';

export interface UnasPermissionsDialogProps {
  open: boolean;
  permissions: string[];
  onClose: () => void;
}

export function UnasPermissionsDialog({ open, permissions, onClose }: UnasPermissionsDialogProps): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="unas-permissions-dialog-title"
      aria-describedby="unas-permissions-dialog-description"
    >
      <DialogTitle id="unas-permissions-dialog-title">{t('settings.unasTest.permissionsTitle')}</DialogTitle>
      <DialogContent>
        {permissions.length > 0 ? (
          <>
            <DialogContentText id="unas-permissions-dialog-description">
              {t('settings.unasTest.permissionsDescription')}
            </DialogContentText>
            <List dense>
              {permissions.map((permission) => (
                <ListItem key={permission} disableGutters>
                  <ListItemText primary={permission} />
                </ListItem>
              ))}
            </List>
          </>
        ) : (
          <DialogContentText id="unas-permissions-dialog-description">
            {t('settings.unasTest.noPermissions')}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="primary" variant="contained" autoFocus sx={{ textTransform: 'none', px: 3 }}>
          {t('common.ok') || 'OK'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
