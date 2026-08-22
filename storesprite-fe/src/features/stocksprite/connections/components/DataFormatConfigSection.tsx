import React from 'react';
import {
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import CodeIcon from '@mui/icons-material/Code';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import { useFormContext, Controller } from 'react-hook-form';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';
import type { ConnectionFormValues } from '../schema/connectionFormSchema.js';
import type { DataConnectionFormat } from '../../../../types/DataConnection.interface.js';

export function DataFormatConfigSection(): React.JSX.Element {
  const { t } = useAppTranslation();
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ConnectionFormValues>();

  const dataFormat = watch('dataFormat');

  const handleFormatChange = (newFormat: DataConnectionFormat): void => {
    if (newFormat === dataFormat) return;
    setValue('dataFormat', newFormat, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <>
      {/* Data Format Selection Card */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SchemaOutlinedIcon color="primary" fontSize="small" />
            {t('stocksprite.connections.form.dataFormat')}
          </Typography>
          <FormControl fullWidth required>
            <InputLabel id="connection-format-label">{t('stocksprite.connections.form.dataFormat')}</InputLabel>
            <Select
              labelId="connection-format-label"
              id="connection-format-select"
              value={dataFormat}
              label={t('stocksprite.connections.form.dataFormat')}
              onChange={(e) => handleFormatChange(e.target.value as DataConnectionFormat)}
            >
              <MenuItem value="CSV">CSV (Comma/Semicolon Separated Values)</MenuItem>
              <MenuItem value="XML">XML (Extensible Markup Language)</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* CSV Parser Settings */}
      {dataFormat === 'CSV' && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableViewIcon color="primary" fontSize="small" />
              {t('stocksprite.connections.form.csv.title')}
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  required
                  name="csv_delimiter"
                  autoComplete="off"
                  label={t('stocksprite.connections.form.csv.delimiter')}
                  placeholder=";"
                  {...register('csvDelimiter')}
                  error={Boolean(errors.csvDelimiter)}
                  helperText={errors.csvDelimiter?.message || t('stocksprite.connections.form.csv.delimiterHelper')}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel id="csv-encoding-label">{t('stocksprite.connections.form.csv.encoding')}</InputLabel>
                  <Controller
                    name="csvEncoding"
                    control={control}
                    render={({ field }) => (
                      <Select
                        labelId="csv-encoding-label"
                        id="csv-encoding-select"
                        {...field}
                        label={t('stocksprite.connections.form.csv.encoding')}
                      >
                        <MenuItem value="UTF-8">UTF-8</MenuItem>
                        <MenuItem value="ISO-8859-1">ISO-8859-1 (Latin-1)</MenuItem>
                        <MenuItem value="ISO-8859-2">ISO-8859-2 (Central European)</MenuItem>
                        <MenuItem value="windows-1250">Windows-1250</MenuItem>
                        <MenuItem value="windows-1252">Windows-1252</MenuItem>
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <Controller
                  name="csvHasHeaders"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label={t('stocksprite.connections.form.csv.hasHeaders')}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* XML Parser Settings */}
      {dataFormat === 'XML' && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon color="primary" fontSize="small" />
              {t('stocksprite.connections.form.xml.title')}
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  name="xml_row_path"
                  autoComplete="off"
                  label={t('stocksprite.connections.form.xml.rowPath')}
                  placeholder=".//product"
                  {...register('xmlRowPath')}
                  error={Boolean(errors.xmlRowPath)}
                  helperText={errors.xmlRowPath?.message || t('stocksprite.connections.form.xml.rowPathHelper')}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="xml_attribute_prefix"
                  autoComplete="off"
                  label={t('stocksprite.connections.form.xml.attributePrefix')}
                  placeholder="@"
                  {...register('xmlAttributePrefix')}
                  helperText={t('stocksprite.connections.form.xml.attributePrefixHelper')}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="xmlIncludeAttributes"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label={t('stocksprite.connections.form.xml.includeAttributes')}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </>
  );
}
