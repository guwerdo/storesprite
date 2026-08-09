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
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';

export default function StoreChatSettingsTab(): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Card elevation={1}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {t('storeChat.config.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('storeChat.config.description')}
          </Typography>

          <Stack spacing={2.5}>
            <TextField
              select
              label={t('storeChat.config.model')}
              defaultValue="gemini-flash"
              fullWidth
              size="small"
            >
              <MenuItem value="gemini-flash">Gemini 3.7 Flash</MenuItem>
              <MenuItem value="gemini-pro">Gemini Pro</MenuItem>
            </TextField>

            <TextField
              label={t('storeChat.config.systemPrompt')}
              multiline
              rows={3}
              defaultValue="You are StoreSprite AI, an intelligent e-commerce catalog assistant specialized in UNAS webshops and supplier inventory management."
              fullWidth
              size="small"
            />

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Enable live OpenSearch semantic grounding"
            />

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" color="inherit">
                {t('common.reset')}
              </Button>
              <Button variant="contained" color="primary">
                {t('storeChat.config.saveButton')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
