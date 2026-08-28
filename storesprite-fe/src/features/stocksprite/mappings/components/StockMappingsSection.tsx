import React from 'react';
import { Box, Button, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';
import type { IWarehouse } from '../../../../types/UnasConnection.interface.js';
import type { IMappingRuleDefinition } from '../../../../types/Mapping.interface.js';
import RulesEditor from './RulesEditor.js';
import { emptyStockMappingFormValue, MappingFormValues, StockMappingFormValue } from '../schema/mappingFormSchema.js';

export interface StockMappingsSectionProps {
  columns: string[];
  warehouses: IWarehouse[];
  rulesDict: IMappingRuleDefinition[];
}

export default function StockMappingsSection({
  columns,
  warehouses,
  rulesDict,
}: StockMappingsSectionProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const { control } = useFormContext<MappingFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'stockMappings' });

  const watched = useWatch({ control, name: 'stockMappings' }) as StockMappingFormValue[] | undefined;

  const isColumnUsedByOther = (col: string, currentIndex: number): boolean =>
    (watched ?? []).some((item, i) => i !== currentIndex && item.column === col);

  const isWarehouseUsedByOther = (warehouseId: number, currentIndex: number): boolean =>
    (watched ?? []).some((item, i) => i !== currentIndex && item.warehouseId === String(warehouseId));

  const handleAdd = (): void => {
    append(emptyStockMappingFormValue());
  };

  return (
    <Box>
      {fields.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('stocksprite.mappings.form.noStockMappings')}
        </Typography>
      )}

      {fields.map((field, index) => (
        <Box
          key={field.id}
          sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Controller
              name={`stockMappings.${index}.column`}
              control={control}
              render={({ field: f }) => (
                <TextField
                  select
                  size="small"
                  label={t('stocksprite.mappings.form.dataSourceColumn')}
                  sx={{ minWidth: 180 }}
                  {...f}
                >
                  {columns.map((c) => (
                    <MenuItem key={c} value={c} disabled={isColumnUsedByOther(c, index)}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name={`stockMappings.${index}.warehouseId`}
              control={control}
              render={({ field: f }) => (
                <TextField
                  select
                  size="small"
                  label={t('stocksprite.mappings.form.unasWarehouse')}
                  sx={{ minWidth: 210 }}
                  {...f}
                >
                  {warehouses.map((w) => (
                    <MenuItem key={w.id} value={String(w.id)} disabled={isWarehouseUsedByOther(w.id, index)}>
                      {w.name} ({w.id})
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <IconButton size="small" onClick={() => remove(index)} aria-label={t('stocksprite.mappings.rules.remove')}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>

          <RulesEditor
            name={`stockMappings.${index}.rules`}
            group="stock"
            rulesDict={rulesDict}
            sample={10}
          />
        </Box>
      ))}

      <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} sx={{ textTransform: 'none' }}>
        {t('stocksprite.mappings.form.addStockMapping')}
      </Button>
    </Box>
  );
}
