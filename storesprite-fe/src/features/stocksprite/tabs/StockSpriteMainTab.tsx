import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Alert,
  CircularProgress,
  Grid2 as Grid,
  Card,
  CardContent,
  Chip,
  Stack,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import type { IHttpClient } from '../../../types/HttpClient.interface.js';
import type { IHelloAuthResponse } from '../../../types/StockSprite.interface.js';

export default function StockSpriteMainTab(): React.JSX.Element {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const httpClient = useInjection<IHttpClient>(TYPES.IHttpClient);

  const [greeting, setGreeting] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isLoaded) return;

    const fetchProtectedHello = async (): Promise<void> => {
      try {
        setLoading(true);
        const token = await getToken();
        const data = await httpClient.get<IHelloAuthResponse>('/client/hello-auth', {
          Authorization: `Bearer ${token ?? ''}`,
        });

        if (!isMounted) return;

        setGreeting(data.greetings ?? null);
        setUserId(data.userId ?? null);
      } catch (err: unknown) {
        if (!isMounted) return;
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch backend status';
        setError(errorMsg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (isSignedIn) {
      void fetchProtectedHello();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn, getToken, httpClient]);

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

      {/* Backend Auth Diagnostic / Status Banner */}
      <Card elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Backend Synchronization Gateway
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Automate product stock count updates, price syncs, and product catalog synchronization in your UNAS webshop.
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 1.5 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Connecting to control plane...
            </Typography>
          </Box>
        )}

        {greeting && (
          <Alert severity="success" sx={{ mt: 1.5, borderRadius: '8px' }}>
            Backend API Connected: <strong>{greeting}</strong> (User ID: {userId})
          </Alert>
        )}

        {error && (
          <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '8px' }}>
            Backend connection notice: {error}
          </Alert>
        )}
      </Card>
    </Box>
  );
}
