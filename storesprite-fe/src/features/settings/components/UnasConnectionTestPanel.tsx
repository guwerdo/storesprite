import React, { useState } from 'react';
import { Box, Button, Typography, CircularProgress, Link, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import { Util } from '../../../utils/index.js';
import type { IUnasConnection } from '../../../types/UnasConnection.interface.js';
import { UnasPermissionsDialog } from './UnasPermissionsDialog.js';

export interface UnasConnectionTestPanelProps {
  connection: IUnasConnection | null;
  testing: boolean;
  disabled: boolean;
  showSavePrompt: boolean;
  onTest: () => void;
}

export function UnasConnectionTestPanel({
  connection,
  testing,
  disabled,
  showSavePrompt,
  onTest,
}: UnasConnectionTestPanelProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const [permissionsOpen, setPermissionsOpen] = useState<boolean>(false);

  const permissions = connection?.permissions ?? [];

  return (
    <Stack spacing={1}>
      <Box>
        <Button
          id="test-unas-connection-button"
          variant="outlined"
          color="primary"
          disabled={disabled || testing}
          startIcon={testing ? <CircularProgress size={16} color="inherit" /> : undefined}
          onClick={onTest}
          sx={{ textTransform: 'none' }}
        >
          {testing ? t('settings.unasTest.testing') : t('settings.unasTest.testConnection')}
        </Button>
      </Box>

      {showSavePrompt && (
        <Typography variant="body2" color="text.secondary">
          {t('settings.unasTest.saveBeforeTest')}
        </Typography>
      )}

      {connection && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Typography
            variant="body2"
            color="success.main"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <CheckCircleIcon fontSize="small" />
            {t('settings.unasTest.success')}
          </Typography>
          <Typography variant="body2">
            {t('settings.unasTest.lastTest')} {Util.formatDate(connection.checkedAt)}
          </Typography>
          {connection.webshopInfo?.webshopName && (
            <Typography variant="body2">
              {t('settings.unasTest.connected', { webshopName: connection.webshopInfo.webshopName })}
            </Typography>
          )}
          <Link
            component="button"
            variant="body2"
            id="available-permissions-link"
            type="button"
            onClick={() => setPermissionsOpen(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('settings.unasTest.availablePermissions')}
          </Link>
        </Stack>
      )}

      <UnasPermissionsDialog
        open={permissionsOpen}
        permissions={permissions}
        onClose={() => setPermissionsOpen(false)}
      />
    </Stack>
  );
}
