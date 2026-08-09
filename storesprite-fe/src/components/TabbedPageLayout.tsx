import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import type { ITabbedPageLayoutProps, ITabItemConfig } from '../types/TabbedPageLayout.interface.js';

export type { ITabItemConfig, ITabbedPageLayoutProps };

export default function TabbedPageLayout({
  title,
  description,
  tabs,
  initialTab = 0,
  headerAction,
}: ITabbedPageLayoutProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<number>(initialTab);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Title & Header Actions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {headerAction && <Box sx={{ flexShrink: 0 }}>{headerAction}</Box>}
      </Box>

      {/* Horizontal Tabs Bar */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: '10px',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? 'fullWidth' : 'standard'}
          scrollButtons="auto"
          aria-label={`${title} tabs`}
          sx={{
            minHeight: 48,
            px: { xs: 0.5, sm: 1.5 },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              backgroundColor: theme.palette.primary.main,
            },
          }}
        >
          {tabs.map((tab, idx) => (
            <Tab
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              id={`page-tab-${tab.id}`}
              aria-controls={`page-tabpanel-${tab.id}`}
              sx={{
                py: 1.25,
                px: { xs: 2, sm: 3 },
                fontWeight: activeTab === idx ? 700 : 500,
                color: activeTab === idx ? theme.palette.primary.main : 'text.secondary',
              }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      {tabs.map((tab, idx) => (
        <Box
          key={tab.id}
          role="tabpanel"
          hidden={activeTab !== idx}
          id={`page-tabpanel-${tab.id}`}
          aria-labelledby={`page-tab-${tab.id}`}
        >
          {activeTab === idx && <Box>{tab.content}</Box>}
        </Box>
      ))}
    </Box>
  );
}
