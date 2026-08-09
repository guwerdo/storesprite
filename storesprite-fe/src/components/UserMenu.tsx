import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  Switch,
  Chip,
  useTheme,
} from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useColorMode } from '../theme/AppThemeProvider.js';
import { USER_MENU_ITEMS } from '../config/userMenu.js';
import type { IUserMenuItemConfig, IUserMenuProps } from '../types/UserMenu.interface.js';
import { useAppTranslation } from '../i18n/I18nProvider.js';

export default function UserMenu({ anchorEl, open, onClose }: IUserMenuProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { mode, toggleColorMode } = useColorMode();

  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    t('header.defaultUser');

  const email = user?.primaryEmailAddress?.emailAddress;

  const handleItemClick = (item: IUserMenuItemConfig): void => {
    onClose();
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      void navigate(item.path);
    }
  };

  const handleSignOut = (): void => {
    onClose();
    void signOut();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      slotProps={{
        paper: {
          elevation: 4,
          sx: {
            minWidth: 260,
            maxWidth: 320,
            mt: 1.5,
            p: 1,
            borderRadius: '14px',
            overflow: 'visible',
          },
        },
      }}
    >
      {/* User Identity Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          src={user?.imageUrl}
          alt={displayName}
          sx={{
            width: 44,
            height: 44,
            border: `2px solid ${theme.palette.primary.main}`,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
            {displayName}
          </Typography>
          {email && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {email}
            </Typography>
          )}
          <Chip
            label={t('userMenu.tenantAdmin')}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              mt: 0.5,
              height: 20,
              fontSize: '0.675rem',
              fontWeight: 600,
              borderRadius: '4px',
            }}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Configurable Menu Items */}
      {USER_MENU_ITEMS.map((item) => {
        const itemLabel = item.labelKey ? t(item.labelKey) : item.label;
        return (
          <MenuItem
            key={item.id}
            onClick={() => handleItemClick(item)}
            sx={{
              py: 1,
              px: 1.5,
              borderRadius: '8px',
              my: 0.25,
              color: item.color === 'error' ? 'error.main' : 'inherit',
            }}
          >
            <ListItemIcon sx={{ color: item.color === 'error' ? 'error.main' : 'text.secondary', minWidth: 36 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={itemLabel} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        );
      })}

      <Divider sx={{ my: 1 }} />

      {/* Dark Mode Switch Row */}
      <MenuItem
        onClick={toggleColorMode}
        sx={{
          py: 1,
          px: 1.5,
          borderRadius: '8px',
          my: 0.25,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28 }}>
            {mode === 'dark' ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={t('userMenu.darkMode')}
            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
          />
        </Box>
        <Switch
          edge="end"
          size="small"
          checked={mode === 'dark'}
          onChange={toggleColorMode}
          onClick={(e) => e.stopPropagation()}
        />
      </MenuItem>

      <Divider sx={{ my: 1 }} />

      {/* Sign Out Button */}
      <MenuItem
        onClick={handleSignOut}
        sx={{
          py: 1,
          px: 1.5,
          borderRadius: '8px',
          my: 0.25,
          color: 'error.main',
          '&:hover': {
            backgroundColor: 'error.lighter',
          },
        }}
      >
        <ListItemIcon sx={{ color: 'error.main', minWidth: 36 }}>
          <LogoutOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t('userMenu.signOut')} primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
      </MenuItem>
    </Menu>
  );
}
