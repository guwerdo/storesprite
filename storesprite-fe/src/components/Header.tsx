import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  useTheme,
  ButtonBase,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useUser } from '@clerk/clerk-react';
import UserMenu from './UserMenu.js';
import { useAppTranslation } from '../i18n/I18nProvider.js';
import type { IHeaderProps } from '../types/Header.interface.js';

export default function Header({ onDrawerToggle }: IHeaderProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const { user } = useUser();
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleCloseUserMenu = (): void => {
    setUserMenuAnchor(null);
  };

  const displayName =
    user?.fullName ||
    user?.username ||
    user?.firstName ||
    t('header.defaultUser');

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: { xs: 56, sm: 64 } }}>
        {/* Left: Hamburger + Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
          <IconButton
            color="inherit"
            aria-label={t('nav.toggleDrawer')}
            onClick={onDrawerToggle}
            edge="start"
            sx={{
              p: 1,
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '9px',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, #312E81 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: `0 2px 8px ${theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(79, 70, 229, 0.25)'}`,
              }}
            >
              <StorefrontIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                background:
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(90deg, #FFFFFF 0%, #CBD5E1 100%)'
                    : 'linear-gradient(90deg, #0F172A 0%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: { xs: 'none', sm: 'inline-block' },
              }}
            >
              {t('header.title')}
            </Typography>
          </Box>
        </Box>

        {/* Right: User Avatar Trigger */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonBase
            onClick={handleOpenUserMenu}
            aria-label={t('header.userAccountMenu')}
            aria-controls={Boolean(userMenuAnchor) ? 'user-account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={Boolean(userMenuAnchor)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: 0.5,
              pr: { xs: 0.5, sm: 1.5 },
              borderRadius: '24px',
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              transition: 'all 150ms ease-in-out',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                borderColor: theme.palette.primary.main,
              },
            }}
          >
            <Avatar
              src={user?.imageUrl}
              alt={displayName}
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.875rem',
                bgcolor: theme.palette.primary.main,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                display: { xs: 'none', sm: 'block' },
                maxWidth: 120,
              }}
              noWrap
            >
              {displayName}
            </Typography>
          </ButtonBase>

          <UserMenu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleCloseUserMenu}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
