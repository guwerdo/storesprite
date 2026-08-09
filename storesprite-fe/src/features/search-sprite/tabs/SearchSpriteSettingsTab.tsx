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
  Slider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';

export default function SearchSpriteSettingsTab(): React.JSX.Element {
  const { t } = useAppTranslation();

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Card elevation={1}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {t('searchSprite.config.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('searchSprite.config.description')}
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Vector Similarity Threshold (0.0 - 1.0)
              </Typography>
              <Slider
                defaultValue={0.78}
                step={0.01}
                min={0.5}
                max={0.99}
                valueLabelDisplay="auto"
                marks={[
                  { value: 0.5, label: 'Broad (0.5)' },
                  { value: 0.78, label: 'Default (0.78)' },
                  { value: 0.95, label: 'Strict (0.95)' },
                ]}
              />
            </Box>

            <TextField
              label="OpenSearch Index Name"
              defaultValue="unas_catalog_embeddings_v1"
              fullWidth
              size="small"
            />

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Auto-reindex catalog when Stock Sprite completes sync"
            />

            <Divider />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" color="inherit">
                {t('common.reset')}
              </Button>
              <Button variant="contained" color="primary">
                {t('searchSprite.config.saveButton')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
