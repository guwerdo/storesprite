import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Divider,
  Alert,
} from '@mui/material';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';

export default function StockSpriteConfigTab(): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Card elevation={1}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {t('stocksprite.config.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('stocksprite.config.description')}
          </Typography>

          <Alert severity="info" sx={{ mb: 3, borderRadius: '8px' }}>
            {t('stocksprite.config.alert')}
          </Alert>

          <Stack spacing={2.5}>
            <TextField
              label={t('stocksprite.config.endpointUrl')}
              placeholder="https://shop.unas.hu/api"
              defaultValue="https://api.unas.eu/shop"
              fullWidth
              size="small"
            />

            <TextField
              label={t('stocksprite.config.apiKey')}
              type="password"
              placeholder="••••••••••••••••••••••••"
              defaultValue="••••••••••••••••••••••••"
              fullWidth
              size="small"
            />

            <TextField
              label={t('stocksprite.config.batchSize')}
              type="number"
              defaultValue={50}
              fullWidth
              size="small"
              helperText={t('stocksprite.config.batchSizeHelper')}
            />

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" color="inherit">
                {t('common.reset')}
              </Button>
              <Button variant="contained" color="primary">
                {t('stocksprite.config.saveButton')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
