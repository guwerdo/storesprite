import React from 'react';
import { IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export interface PasswordVisibilityToggleProps {
  show: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

export function PasswordVisibilityToggle({
  show,
  onToggle,
  ariaLabel,
}: PasswordVisibilityToggleProps): React.JSX.Element {
  return (
    <InputAdornment position="end">
      <IconButton onClick={onToggle} edge="end" aria-label={ariaLabel}>
        {show ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );
}
