import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import { formatDateTime } from '../../../utils/date-util.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { ISocketService } from '../../../types/SocketService.interface.js';
import type { IMappingHistoryDto, MappingRunStatus } from '../../../types/stocksprite/Mapping.interface.js';

export interface RunHistoryPanelProps {
  mappingId: string;
  /** Incremented by the caller right after a manual run was triggered to force a reload. */
  refreshSignal?: number;
}

/**
 * Socket.IO payload for mapping runs. The backend relays the processor's
 * progress bodies to the tenant room as `{ mappingId, runId, progress, ...counters }`.
 */
interface MappingRunSocketEvent {
  mappingId: string;
  runId: string;
  progress: string;
  processedItems?: number;
  updatedItems?: number;
  unchangedItems?: number;
  warningCount?: number;
  errorCount?: number;
}

function statusColor(status: MappingRunStatus): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'running':
      return 'info';
    case 'success':
      return 'success';
    case 'partial':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
}

export default function RunHistoryPanel({ mappingId, refreshSignal = 0 }: RunHistoryPanelProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const { getToken, userId } = useAuth();
  const mappingService = useInjection<IMappingService>(TYPES.IMappingService);
  const socketService = useInjection<ISocketService>(TYPES.ISocketService);

  const [rows, setRows] = useState<IMappingHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (silent = false): Promise<void> => {
      if (!silent) {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const token = await getToken();
        if (!token) {
          setRows([]);
          return;
        }
        const response = await mappingService.getHistory(token, mappingId);
        setRows(response.history ?? []);
      } catch (err: unknown) {
        if (!silent) {
          setLoadError((err as Error).message || t('stocksprite.history.loadFailed'));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [getToken, mappingService, mappingId, t]
  );

  // Initial load + reload when the parent asks for a refresh (manual run just triggered).
  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory, refreshSignal]);

  // Live updates: reload (silently) whenever a run of THIS mapping reports progress/result.
  useEffect(() => {
    if (!userId) {
      return;
    }
    socketService.connect(userId);
    const onRunEvent = (event: MappingRunSocketEvent): void => {
      if (event.mappingId === mappingId) {
        void fetchHistory(true);
      }
    };
    socketService.on('mapping_run_progress', onRunEvent);
    socketService.on('mapping_run_result', onRunEvent);
    return () => {
      socketService.off('mapping_run_progress', onRunEvent);
      socketService.off('mapping_run_result', onRunEvent);
    };
  }, [userId, mappingId, socketService, fetchHistory]);

  const stats = useMemo(() => {
    let running = 0;
    let success = 0;
    let partial = 0;
    let failed = 0;
    let processedItems = 0;
    let updatedItems = 0;
    for (const row of rows) {
      switch (row.status) {
        case 'running':
          running += 1;
          break;
        case 'success':
          success += 1;
          break;
        case 'partial':
          partial += 1;
          break;
        case 'failed':
          failed += 1;
          break;
      }
      processedItems += row.processedItems;
      updatedItems += row.updatedItems;
    }
    return { total: rows.length, running, success, partial, failed, processedItems, updatedItems };
  }, [rows]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <HistoryIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('stocksprite.history.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('stocksprite.history.subtitle')}
        </Typography>

        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip size="small" variant="outlined" label={`${t('stocksprite.history.stats.totalRuns')}: ${stats.total}`} />
          <Chip size="small" color="info" variant="outlined" label={`${t('stocksprite.history.stats.running')}: ${stats.running}`} />
          <Chip size="small" color="success" variant="outlined" label={`${t('stocksprite.history.stats.success')}: ${stats.success}`} />
          <Chip size="small" color="warning" variant="outlined" label={`${t('stocksprite.history.stats.partial')}: ${stats.partial}`} />
          <Chip size="small" color="error" variant="outlined" label={`${t('stocksprite.history.stats.failed')}: ${stats.failed}`} />
          <Chip size="small" variant="outlined" label={`${t('stocksprite.history.stats.processed')}: ${stats.processedItems}`} />
          <Chip size="small" variant="outlined" label={`${t('stocksprite.history.stats.updated')}: ${stats.updatedItems}`} />
        </Stack>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setLoadError(null)}>
            {loadError}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('stocksprite.history.empty')}
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label={t('stocksprite.history.tableLabel')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('stocksprite.history.table.status')}</TableCell>
                  <TableCell>{t('stocksprite.history.table.trigger')}</TableCell>
                  <TableCell>{t('stocksprite.history.table.startedAt')}</TableCell>
                  <TableCell>{t('stocksprite.history.table.finishedAt')}</TableCell>
                  <TableCell align="right">{t('stocksprite.history.table.processedItems')}</TableCell>
                  <TableCell align="right">{t('stocksprite.history.table.updatedItems')}</TableCell>
                  <TableCell align="right">{t('stocksprite.history.table.unchangedItems')}</TableCell>
                  <TableCell align="right">{t('stocksprite.history.table.warningCount')}</TableCell>
                  <TableCell align="right">{t('stocksprite.history.table.errorCount')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Chip size="small" color={statusColor(row.status)} label={t(`stocksprite.history.status.${row.status}`)} />
                      {row.error && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="error">
                            {row.error}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{t(`stocksprite.history.trigger.${row.trigger}`)}</TableCell>
                    <TableCell>{formatDateTime(row.startedAt)}</TableCell>
                    <TableCell>{row.finishedAt ? formatDateTime(row.finishedAt) : t('stocksprite.history.status.running')}</TableCell>
                    <TableCell align="right">{row.processedItems}</TableCell>
                    <TableCell align="right">{row.updatedItems}</TableCell>
                    <TableCell align="right">{row.unchangedItems}</TableCell>
                    <TableCell align="right">{row.warningCount}</TableCell>
                    <TableCell align="right">{row.errorCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
