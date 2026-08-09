import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  useTheme,
  useMediaQuery,
  Container,
  Divider,
} from '@mui/material';
import Header from './Header.js';
import { DRAWER_NAV_ITEMS } from '../config/navigation.js';
import type { INavItemConfig } from '../types/Navigation.interface.js';
import { useAppTranslation } from '../i18n/I18nProvider.js';

const DRAWER_WIDTH_EXPANDED = 240;
const DRAWER_WIDTH_COLLAPSED = 68;
const DESKTOP_COLLAPSED_KEY = 'storesprite_drawer_collapsed';

export default function Layout(): React.JSX.Element {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile temporary drawer open/close
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Desktop collapsed/expanded state (persisted)
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function') {
        return window.localStorage.getItem(DESKTOP_COLLAPSED_KEY) === 'true';
      }
    } catch {
      // Ignore
    }
    return false;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage?.setItem === 'function') {
        window.localStorage.setItem(DESKTOP_COLLAPSED_KEY, String(desktopCollapsed));
      }
    } catch {
      // Ignore
    }
  }, [desktopCollapsed]);

  const handleDrawerToggle = (): void => {
    if (isDesktop) {
      setDesktopCollapsed((prev) => !prev);
    } else {
      setMobileOpen((prev) => !prev);
    }
  };

  const handleNavClick = (path: string): void => {
    if (!isDesktop) {
      setMobileOpen(false);
    }
    void navigate(path);
  };

  const currentPath = location.pathname;

  const isNavActive = (item: INavItemConfig): boolean => {
    if (item.path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(item.path);
  };

  const currentDrawerWidth = isDesktop
    ? desktopCollapsed
      ? DRAWER_WIDTH_COLLAPSED
      : DRAWER_WIDTH_EXPANDED
    : DRAWER_WIDTH_EXPANDED;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
      <Divider />
      <List sx={{ px: 1, py: 1.5, flexGrow: 1 }}>
        {DRAWER_NAV_ITEMS.map((item) => {
          const active = isNavActive(item);
          const localizedLabel = item.labelKey ? t(item.labelKey) : item.label;
          const buttonContent = (
            <ListItemButton
              selected={active}
              onClick={() => handleNavClick(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: isDesktop && desktopCollapsed ? 'center' : 'initial',
                px: 2,
                borderRadius: '8px',
                my: 0.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isDesktop && desktopCollapsed ? 0 : 2,
                  justifyContent: 'center',
                  color: active ? theme.palette.primary.main : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {(!isDesktop || !desktopCollapsed) && (
                <ListItemText
                  primary={localizedLabel}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: active ? 700 : 500,
                  }}
                />
              )}
            </ListItemButton>
          );

          return (
            <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
              {isDesktop && desktopCollapsed ? (
                <Tooltip title={localizedLabel} placement="right" arrow>
                  {buttonContent}
                </Tooltip>
              ) : (
                buttonContent
              )}
              {item.dividerAfter && <Divider sx={{ my: 1 }} />}
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top Application Header */}
      <Header onDrawerToggle={handleDrawerToggle} />

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
        aria-label="application navigation"
      >
        {/* Mobile Temporary Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH_EXPANDED,
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop Collapsible Mini-Variant Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${currentDrawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2.5, sm: 3, md: 4 },
            px: { xs: 2, sm: 3, md: 4 },
            flexGrow: 1,
          }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
