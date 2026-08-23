import React from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';
import type {
  ConnectionTestResult,
  ConnectionTestProgress,
} from '../../../../types/DataConnection.interface.js';

export interface ConnectionTestPaneProps {
  testResult: ConnectionTestResult | null;
  testingProgress: ConnectionTestProgress;
  isTestingRunning: boolean;
}

export function ConnectionTestPane({
  testResult,
  testingProgress,
  isTestingRunning,
}: ConnectionTestPaneProps): React.JSX.Element {
  const { t } = useAppTranslation();

  const getProgressStatusText = (): string => {
    if (testingProgress === 'start') return t('stocksprite.connections.form.testing.start');
    if (testingProgress === 'download') return t('stocksprite.connections.form.testing.download');
    if (testingProgress === 'convert') return t('stocksprite.connections.form.testing.convert');
    return t('stocksprite.connections.form.testing.finish');
  };

  return (
    <>
      {/* Test in Progress Alert */}
      {isTestingRunning && (
        <Alert
          severity="info"
          icon={<CircularProgress size={20} color="inherit" />}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {getProgressStatusText()}
          </Typography>
        </Alert>
      )}

      {/* Completed Test Results Card */}
      {testResult && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {testResult.success ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <ErrorIcon color="error" />
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {testResult.success
                    ? t('stocksprite.connections.form.testing.successTitle')
                    : t('stocksprite.connections.form.testing.failedTitle')}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {testResult.started_at
                  ? `${t('stocksprite.connections.form.testing.lastTested')} ${new Date(testResult.started_at).toLocaleString()}`
                  : ''}
              </Typography>
            </Box>

            <Divider />

            {/* Error Message */}
            {!testResult.success && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Alert severity="error">
                  {testResult.errorMessage || t('stocksprite.connections.form.testing.unknownError')}
                </Alert>
              </Box>
            )}

            {/* Test Metrics Grid */}
            {testResult.success && (
              <>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.duration')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.duration_ms ? `${(testResult.duration_ms / 1000).toFixed(2)}s` : '-'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.rowCount')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.rowCount ?? 0}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.columnCount')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.columnCount ?? testResult.columns?.length ?? 0}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stocksprite.connections.form.testing.fileSize')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {testResult.fileSize ? `${(testResult.fileSize / 1024).toFixed(1)} KB` : '-'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* 3 Sample Data Rows Preview Table */}
                {testResult.columns && testResult.columns.length > 0 && testResult.rows && testResult.rows.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {t('stocksprite.connections.form.testing.samplePreview')}
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            {testResult.columns.map((col, idx) => (
                              <TableCell key={idx} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {col}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {testResult.rows.slice(0, 3).map((row, rIdx) => (
                            <TableRow key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <TableCell key={cIdx} sx={{ whiteSpace: 'nowrap' }}>
                                  {cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('stocksprite.connections.form.testing.noDataRows')}
                  </Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Untested Notification */}
      {!testResult && !isTestingRunning && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          {t('stocksprite.connections.form.testing.notTested')}
        </Alert>
      )}
    </>
  );
}
