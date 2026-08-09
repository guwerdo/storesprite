import React, { useState } from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  IconButton,
  useTheme,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ArticleIcon from '@mui/icons-material/Article';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useColorMode } from '../theme/AppThemeProvider.js';

import { useUser } from '@clerk/clerk-react';

const DRAWER_WIDTH = 220;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/', icon: <HomeIcon /> },
  { label: 'Sample Page', path: '/sample', icon: <ArticleIcon /> },
];

export default function Layout(): React.JSX.Element {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('/');
  const theme = useTheme();
  const { toggleColorMode } = useColorMode();
  const { user } = useUser();

  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'User';

  const handleNavClick = (path: string): void => {
    setSelected(path);
    void navigate(path);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* Top Header Bar */}
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            storesprite
          </Typography>
          <IconButton sx={{ ml: 1 }} onClick={toggleColorMode} color="inherit" aria-label="toggle dark/light mode">
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <Button color="inherit" component={RouterLink} to="/profile">
            {displayName}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Left Navigation Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Divider />
        <List>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.path}
              selected={selected === item.path}
              onClick={() => handleNavClick(item.path)}
            >
              <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </Box>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
