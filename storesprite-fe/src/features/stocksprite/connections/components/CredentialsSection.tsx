import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useFormContext, Controller } from 'react-hook-form';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';
import { PasswordVisibilityToggle } from '../../../../components/PasswordVisibilityToggle.js';
import type { ConnectionFormValues } from '../schema/connectionFormSchema.js';

export function CredentialsSection(): React.JSX.Element {
  const { t } = useAppTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ConnectionFormValues>();

  const channel = watch('channel');
  const httpAuthType = watch('httpAuthType');
  const sftpAuthType = watch('sftpAuthType');

  // Password visibility toggles (pure local ephemeral UI state)
  const [showBasicPassword, setShowBasicPassword] = useState(false);
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);
  const [showSftpPassword, setShowSftpPassword] = useState(false);
  const [showSftpPassphrase, setShowSftpPassphrase] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setValue('sftpPrivateKey', content, { shouldDirty: true, shouldValidate: true });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon color="primary" fontSize="small" />
          {t('stocksprite.connections.form.credentials.title')}
        </Typography>

        {/* HTTP Authentication Options */}
        {channel === 'HTTP' && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="http-auth-type-label">
                  {t('stocksprite.connections.form.credentials.authType')}
                </InputLabel>
                <Controller
                  name="httpAuthType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      labelId="http-auth-type-label"
                      id="http-auth-type-select"
                      {...field}
                      label={t('stocksprite.connections.form.credentials.authType')}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="NONE">
                        {t('stocksprite.connections.form.credentials.http.none')}
                      </MenuItem>
                      <MenuItem value="BASIC">
                        {t('stocksprite.connections.form.credentials.http.basic')}
                      </MenuItem>
                      <MenuItem value="BEARER">
                        {t('stocksprite.connections.form.credentials.http.bearer')}
                      </MenuItem>
                      <MenuItem value="API_KEY">
                        {t('stocksprite.connections.form.credentials.http.apiKey')}
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>

            {/* HTTP Basic Auth Fields */}
            {httpAuthType === 'BASIC' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    label={t('stocksprite.connections.form.credentials.http.username')}
                    {...register('httpBasicUsername')}
                    error={Boolean(errors.httpBasicUsername)}
                    helperText={errors.httpBasicUsername?.message}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    type={showBasicPassword ? 'text' : 'password'}
                    label={t('stocksprite.connections.form.credentials.http.password')}
                    {...register('httpBasicPassword')}
                    error={Boolean(errors.httpBasicPassword)}
                    helperText={errors.httpBasicPassword?.message}
                    InputProps={{
                      endAdornment: (
                        <PasswordVisibilityToggle
                          show={showBasicPassword}
                          onToggle={() => setShowBasicPassword(!showBasicPassword)}
                          ariaLabel="toggle basic password visibility"
                        />
                      ),
                    }}
                  />
                </Grid>
              </>
            )}

            {/* HTTP Bearer Token Field */}
            {httpAuthType === 'BEARER' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  autoComplete="off"
                  type={showBearerToken ? 'text' : 'password'}
                  label={t('stocksprite.connections.form.credentials.http.token')}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  {...register('httpBearerToken')}
                  error={Boolean(errors.httpBearerToken)}
                  helperText={errors.httpBearerToken?.message || t('stocksprite.connections.form.credentials.http.tokenHelper')}
                  InputProps={{
                    endAdornment: (
                      <PasswordVisibilityToggle
                        show={showBearerToken}
                        onToggle={() => setShowBearerToken(!showBearerToken)}
                        ariaLabel="toggle bearer token visibility"
                      />
                    ),
                  }}
                />
              </Grid>
            )}

            {/* HTTP API Key Header Fields */}
            {httpAuthType === 'API_KEY' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    label={t('stocksprite.connections.form.credentials.http.headerName')}
                    placeholder="X-Api-Key"
                    {...register('httpApiKeyHeaderName')}
                    error={Boolean(errors.httpApiKeyHeaderName)}
                    helperText={errors.httpApiKeyHeaderName?.message || t('stocksprite.connections.form.credentials.http.headerNameHelper')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    type={showApiKeyValue ? 'text' : 'password'}
                    label={t('stocksprite.connections.form.credentials.http.headerValue')}
                    placeholder="secret-api-key-value"
                    {...register('httpApiKeyHeaderValue')}
                    error={Boolean(errors.httpApiKeyHeaderValue)}
                    helperText={errors.httpApiKeyHeaderValue?.message}
                    InputProps={{
                      endAdornment: (
                        <PasswordVisibilityToggle
                          show={showApiKeyValue}
                          onToggle={() => setShowApiKeyValue(!showApiKeyValue)}
                          ariaLabel="toggle api key visibility"
                        />
                      ),
                    }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        )}

        {/* SFTP Authentication Options */}
        {channel === 'SFTP' && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="sftp-auth-type-label">
                  {t('stocksprite.connections.form.credentials.authType')}
                </InputLabel>
                <Controller
                  name="sftpAuthType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      labelId="sftp-auth-type-label"
                      id="sftp-auth-type-select"
                      {...field}
                      label={t('stocksprite.connections.form.credentials.authType')}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="PASSWORD">
                        {t('stocksprite.connections.form.credentials.sftp.password')}
                      </MenuItem>
                      <MenuItem value="PRIVATE_KEY">
                        {t('stocksprite.connections.form.credentials.sftp.privateKey')}
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>

            {/* SFTP Password Auth */}
            {sftpAuthType === 'PASSWORD' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    label={t('stocksprite.connections.form.credentials.sftp.username')}
                    {...register('sftpPasswordUsername')}
                    error={Boolean(errors.sftpPasswordUsername)}
                    helperText={errors.sftpPasswordUsername?.message}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    type={showSftpPassword ? 'text' : 'password'}
                    label={t('stocksprite.connections.form.credentials.sftp.passwordField')}
                    {...register('sftpPasswordPassword')}
                    error={Boolean(errors.sftpPasswordPassword)}
                    helperText={errors.sftpPasswordPassword?.message}
                    InputProps={{
                      endAdornment: (
                        <PasswordVisibilityToggle
                          show={showSftpPassword}
                          onToggle={() => setShowSftpPassword(!showSftpPassword)}
                          ariaLabel="toggle sftp password visibility"
                        />
                      ),
                    }}
                  />
                </Grid>
              </>
            )}

            {/* SFTP SSH Key Auth */}
            {sftpAuthType === 'PRIVATE_KEY' && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    autoComplete="off"
                    label={t('stocksprite.connections.form.credentials.sftp.username')}
                    {...register('sftpKeyUsername')}
                    error={Boolean(errors.sftpKeyUsername)}
                    helperText={errors.sftpKeyUsername?.message}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t('stocksprite.connections.form.credentials.sftp.privateKeyField')} *
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UploadFileIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ textTransform: 'none' }}
                    >
                      {t('stocksprite.connections.form.credentials.sftp.uploadKey')}
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".pem,.key,.txt,text/*"
                      onChange={handleFileSelect}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={4}
                    autoComplete="off"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                    {...register('sftpPrivateKey')}
                    error={Boolean(errors.sftpPrivateKey)}
                    helperText={errors.sftpPrivateKey?.message || t('stocksprite.connections.form.credentials.sftp.privateKeyHelper')}
                    sx={{ fontFamily: 'monospace' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    autoComplete="off"
                    type={showSftpPassphrase ? 'text' : 'password'}
                    label={t('stocksprite.connections.form.credentials.sftp.passphrase')}
                    {...register('sftpKeyPassphrase')}
                    helperText={t('stocksprite.connections.form.credentials.sftp.passphraseHelper')}
                    InputProps={{
                      endAdornment: (
                        <PasswordVisibilityToggle
                          show={showSftpPassphrase}
                          onToggle={() => setShowSftpPassphrase(!showSftpPassphrase)}
                          ariaLabel="toggle passphrase visibility"
                        />
                      ),
                    }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}
