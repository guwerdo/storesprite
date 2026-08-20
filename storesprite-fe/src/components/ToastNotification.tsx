import React from 'react';
import { Alert, type AlertColor, Snackbar, type SnackbarCloseReason } from '@mui/material';

export interface ToastNotificationProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
  onClose: (event?: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => void;
}

export default function ToastNotification({
  open,
  message,
  severity = 'success',
  autoHideDuration = 4000,
  onClose,
}: ToastNotificationProps): React.JSX.Element {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{ width: '100%', boxShadow: 3, fontWeight: 500 }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
