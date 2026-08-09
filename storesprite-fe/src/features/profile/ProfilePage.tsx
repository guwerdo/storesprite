import React from 'react';
import {
  Typography,
  Box,
  Button,
  Stack,
  Divider,
  Avatar,
  Card,
  CardContent,
  Chip,
  useTheme,
} from '@mui/material';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { useUser, useClerk } from '@clerk/clerk-react';
import { PROFILE_FIELDS } from '../../config/profileFields.js';
import { useAppTranslation } from '../../i18n/I18nProvider.js';

export default function ProfilePage(): React.JSX.Element {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  const handleDeleteProfile = async (): Promise<void> => {
    if (user && window.confirm(t('profile.deleteAccountConfirm'))) {
      try {
        await user.delete();
      } catch (err: unknown) {
        console.error(err);
      }
    }
  };

  const displayName = user?.fullName || user?.username || t('header.defaultUser');
  const isEmailVerified = user?.primaryEmailAddress?.verification?.status === 'verified';

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        {t('profile.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('profile.description')}
      </Typography>

      <Card elevation={1} sx={{ mt: 3, borderRadius: '12px' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Header User Identity */}
            <Stack direction="row" spacing={2.5} alignItems="center">
              <Avatar
                src={user?.imageUrl}
                alt={displayName}
                sx={{
                  width: 64,
                  height: 64,
                  border: `2px solid ${theme.palette.primary.main}`,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  bgcolor: theme.palette.primary.main,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {displayName}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {user?.primaryEmailAddress?.emailAddress || t('userMenu.noEmail')}
                  </Typography>
                  {user?.primaryEmailAddress?.emailAddress && (
                    <Chip
                      icon={isEmailVerified ? <VerifiedOutlinedIcon /> : undefined}
                      label={isEmailVerified ? t('profile.verified') : t('profile.unverified')}
                      color={isEmailVerified ? 'success' : 'warning'}
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            <Divider />

            {/* Declarative Profile Field Rows */}
            <Stack spacing={2}>
              {PROFILE_FIELDS.map((field) => {
                const localizedFieldLabel = field.labelKey ? t(field.labelKey) : field.label;
                return (
                  <Box key={field.label}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                      {localizedFieldLabel}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>
                        {field.getValue(user)}
                      </Typography>
                      {field.label === 'Primary Email' && user?.primaryEmailAddress?.emailAddress && (
                        <Chip
                          label={isEmailVerified ? t('profile.verified') : t('profile.unverified')}
                          color={isEmailVerified ? 'success' : 'warning'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600 }}
                        />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>

            <Divider />

            {/* Profile Actions */}
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
              <Button
                variant="contained"
                color="primary"
                startIcon={<ManageAccountsOutlinedIcon />}
                onClick={() => openUserProfile()}
              >
                {t('profile.manageAccount')}
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => void handleDeleteProfile()}
              >
                {t('profile.deleteAccount')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
