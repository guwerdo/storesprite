import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Divider,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  IconButton,
  InputAdornment,
  Tooltip,
  type SelectChangeEvent,
} from '@mui/material';
import ToastNotification from '../../components/ToastNotification.js';
import SaveIcon from '@mui/icons-material/Save';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '@clerk/clerk-react';
import { useInjection } from '../../di/ContainerProvider.js';
import { TYPES } from '../../di/types.js';
import type { ISettingService } from '../../types/SettingService.interface.js';
import type { ILanguage } from '../../types/Setting.interface.js';
import { useAppTranslation } from '../../i18n/I18nProvider.js';

export default function SettingsPage(): React.JSX.Element {
  const { t, language, setLanguage } = useAppTranslation();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const settingService = useInjection<ISettingService>(TYPES.ISettingService);

  const DEFAULT_UNAS_API_ENDPOINT = 'https://api.unas.eu/shop/';

  const [unasApiEndpoint, setUnasApiEndpoint] = useState<string>(DEFAULT_UNAS_API_ENDPOINT);
  const [unasApiEndpointTouched, setUnasApiEndpointTouched] = useState<boolean>(false);
  const [unasApiKey, setUnasApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [selectedLanguageId, setSelectedLanguageId] = useState<number | ''>('');
  const [languages, setLanguages] = useState<ILanguage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const getEndpointError = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return t('settings.unasApiEndpointRequired');
    }
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.protocol !== 'https:') {
        return t('settings.unasApiEndpointInvalid');
      }
    } catch {
      return t('settings.unasApiEndpointInvalid');
    }
    return null;
  };

  const endpointError = unasApiEndpointTouched ? getEndpointError(unasApiEndpoint) : null;

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async (): Promise<void> => {
      if (!isLoaded || !isSignedIn) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = await getToken();
        const response = await settingService.getSettings(token ?? '');

        if (!isMounted) return;

        const availableLanguages = response.languages || [];
        setLanguages(availableLanguages);

        if (response.settings?.unasApiEndpoint) {
          setUnasApiEndpoint(response.settings.unasApiEndpoint);
        } else {
          setUnasApiEndpoint(DEFAULT_UNAS_API_ENDPOINT);
        }

        if (response.settings?.unasApiKey) {
          setUnasApiKey(response.settings.unasApiKey);
        }

        if (response.settings?.languageId) {
          setSelectedLanguageId(response.settings.languageId);
          const activeLang = availableLanguages.find((l) => l.id === response.settings?.languageId);
          if (activeLang) {
            void setLanguage(activeLang.code);
          }
        } else if (availableLanguages.length > 0) {
          const matchCurrent = availableLanguages.find(
            (l) => l.code.toLowerCase() === language.toLowerCase()
          );
          const defaultLang = matchCurrent || availableLanguages[0];
          setSelectedLanguageId(defaultLang.id);
        }
      } catch (err: unknown) {
        console.error('Failed to load user settings:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn, getToken, settingService]);

  const handleLanguageChange = (event: SelectChangeEvent<number | ''>): void => {
    const value = event.target.value;
    const numValue = value === '' ? '' : Number(value);
    setSelectedLanguageId(numValue);

    if (numValue !== '') {
      const selected = languages.find((l) => l.id === numValue);
      if (selected) {
        void setLanguage(selected.code);
      }
    }
  };

  const handleSave = async (): Promise<void> => {
    setUnasApiEndpointTouched(true);
    const validationError = getEndpointError(unasApiEndpoint);
    if (validationError) {
      return;
    }

    try {
      setSaving(true);
      const token = await getToken();
      await settingService.saveSettings(token ?? '', {
        unasApiKey,
        unasApiEndpoint: unasApiEndpoint.trim(),
        languageId: selectedLanguageId === '' ? null : Number(selectedLanguageId),
      });

      setSnackbar({
        open: true,
        message: t('settings.settingsSaved'),
        severity: 'success',
      });
    } catch (err: unknown) {
      console.error('Failed to save settings:', err);
      setSnackbar({
        open: true,
        message: t('settings.settingsSaveFailed'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = (): void => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        {t('settings.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('settings.description')}
      </Typography>

      <Card elevation={1} sx={{ mt: 3, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {t('settings.userPreferences')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('settings.userPreferencesDesc')}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          ) : (
            <Stack spacing={3}>
              <TextField
                id="unas-api-endpoint-input"
                label={t('settings.unasApiEndpoint')}
                placeholder={t('settings.unasApiEndpointPlaceholder')}
                value={unasApiEndpoint}
                onChange={(e) => setUnasApiEndpoint(e.target.value)}
                onBlur={() => setUnasApiEndpointTouched(true)}
                error={Boolean(endpointError)}
                helperText={endpointError || t('settings.unasApiEndpointHelper')}
                inputProps={{ maxLength: 255 }}
                fullWidth
                size="small"
                required
              />

              <TextField
                id="unas-api-key-input"
                label={t('settings.unasApiKey')}
                placeholder={t('settings.unasApiKeyPlaceholder')}
                type={showApiKey ? 'text' : 'password'}
                value={unasApiKey}
                onChange={(e) => setUnasApiKey(e.target.value)}
                inputProps={{ maxLength: 255 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showApiKey ? t('settings.hideApiKey') : t('settings.showApiKey')}>
                        <IconButton
                          id="toggle-api-key-visibility-button"
                          aria-label={showApiKey ? t('settings.hideApiKey') : t('settings.showApiKey')}
                          onClick={() => setShowApiKey((prev) => !prev)}
                          edge="end"
                          size="small"
                        >
                          {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                helperText={t('settings.unasApiKeyHelper')}
                fullWidth
                size="small"
              />

              <FormControl fullWidth size="small">
                <InputLabel id="language-select-label">{t('settings.language')}</InputLabel>
                <Select
                  labelId="language-select-label"
                  id="language-select"
                  value={selectedLanguageId}
                  label={t('settings.language')}
                  onChange={handleLanguageChange}
                >
                  {languages.map((lang) => (
                    <MenuItem key={lang.id} value={lang.id}>
                      {t(`languages.${lang.code.toLowerCase()}`) || lang.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider sx={{ my: 1 }} />

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  id="save-settings-button"
                  variant="contained"
                  color="primary"
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? t('common.saving') : t('settings.saveSettings')}
                </Button>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>

      <ToastNotification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />
    </Box>
  );
}
