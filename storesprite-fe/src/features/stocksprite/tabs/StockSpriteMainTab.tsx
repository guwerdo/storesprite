import React from 'react';
import {
  Typography,
  Box,
  Grid2 as Grid,
  Card,
  CardContent,
  Chip,
  Stack,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';

export default function StockSpriteMainTab(): React.JSX.Element {
  return (
    <Box>
      {/* Quick Stat Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card elevation={1}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  UNAS Webshop Status
                </Typography>
                <Chip
                  icon={<CheckCircleOutlineIcon sx={{ fontSize: '1rem !important' }} />}
                  label="Connected"
                  color="success"
                  size="small"
                  sx={{ borderRadius: '6px', fontWeight: 600 }}
                />
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                Ready for Sync
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Rate limit quota: 6,000 req/hr
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card elevation={1}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Supplier Feeds
                </Typography>
                <StorageIcon color="primary" fontSize="small" />
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                Dunitker & Cromwell
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Multi-warehouse stock mapping active
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 12, md: 4 }}>
          <Card elevation={1}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Sync Engine
                </Typography>
                <SyncIcon color="secondary" fontSize="small" />
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                On-Demand Worker
              </Typography>
              <Typography variant="caption" color="text.secondary">
                BullMQ & Docker Worker Orchestrator
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
