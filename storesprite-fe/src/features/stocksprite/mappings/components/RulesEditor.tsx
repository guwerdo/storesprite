import React, { useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RemoveIcon from '@mui/icons-material/Remove';
import { Controller, useFieldArray, useFormContext, useWatch, type FieldArrayPath, type FieldPath } from 'react-hook-form';
import { useAppTranslation } from '../../../../i18n/I18nProvider.js';
import type { IMappingRuleDefinition } from '../../../../types/Mapping.interface.js';
import { computePreview } from '../rulePreview.js';
import {
  emptyRuleFormValue,
  MappingFormValues,
  RuleFormValue,
} from '../schema/mappingFormSchema.js';

export interface RulesEditorProps {
  name: string;
  group: 'sku' | 'stock';
  rulesDict: IMappingRuleDefinition[];
  sample: string | number;
}

export default function RulesEditor({ name, group, rulesDict, sample }: RulesEditorProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const { control } = useFormContext<MappingFormValues>();
  const fieldArrayName = name as FieldArrayPath<MappingFormValues>;

  const { fields, append, remove, move } = useFieldArray({ control, name: fieldArrayName });
  const [expanded, setExpanded] = useState<boolean>(() => fields.length === 0);

  const watchedRules = useWatch({ control, name: fieldArrayName }) as RuleFormValue[] | undefined;
  const groupRules = rulesDict.filter((r) => r.groups.includes(group));
  const previewSteps = computePreview(watchedRules ?? [], sample);

  const handleAddRule = (): void => {
    append(emptyRuleFormValue());
    setExpanded(true);
  };

  return (
    <Box sx={{ ml: 2, mt: 1, borderLeft: '2px solid', borderColor: 'divider', pl: 1.5 }}>
      <Button
        size="small"
        onClick={() => setExpanded((v) => !v)}
        startIcon={expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        sx={{ textTransform: 'none', color: 'text.secondary' }}
      >
        {t('stocksprite.mappings.rules.collapse')} ({fields.length})
      </Button>

      <Collapse in={expanded}>
        {fields.map((field, index) => (
          <RuleRow
            key={field.id}
            name={`${name}.${index}`}
            index={index}
            count={fields.length}
            groupRules={groupRules}
            onRemove={() => remove(index)}
            onMoveUp={() => move(index, index - 1)}
            onMoveDown={() => move(index, index + 1)}
          />
        ))}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddRule} sx={{ textTransform: 'none' }}>
            {t('stocksprite.mappings.rules.add')}
          </Button>
        </Box>

        {previewSteps.length > 1 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {t('stocksprite.mappings.rules.preview')} {previewSteps.join(' → ')}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {t('stocksprite.mappings.rules.optional')}
        </Typography>
      </Collapse>
    </Box>
  );
}

interface RuleRowProps {
  name: string;
  index: number;
  count: number;
  groupRules: IMappingRuleDefinition[];
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function RuleRow({ name, index, count, groupRules, onRemove, onMoveUp, onMoveDown }: RuleRowProps): React.JSX.Element {
  const { t } = useAppTranslation();
  const { control, register } = useFormContext<MappingFormValues>();

  const op = useWatch({ control, name: `${name}.op` as FieldPath<MappingFormValues> }) as unknown as string | undefined;
  const paramDefs = groupRules.find((r) => r.op === op)?.params ?? [];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 0.25 }}>
      <Controller
        name={`${name}.op` as FieldPath<MappingFormValues>}
        control={control}
        render={({ field }) => (
          <TextField select size="small" label={t('stocksprite.mappings.rules.op')} sx={{ minWidth: 140 }} {...field}>
            {groupRules.map((r) => (
              <MenuItem key={r.op} value={r.op}>
                {t(`stocksprite.mappings.rules.ops.${r.op}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      {paramDefs.map((p) => (
        <TextField
          key={p.name}
          size="small"
          type={p.type === 'number' ? 'number' : 'text'}
          label={t(`stocksprite.mappings.rules.params.${p.name}`)}
          sx={{ width: 110 }}
          {...register(`${name}.params.${p.name}` as FieldPath<MappingFormValues>)}
        />
      ))}

      <IconButton size="small" onClick={onMoveUp} disabled={index === 0} aria-label={t('stocksprite.mappings.rules.moveUp')}>
        <KeyboardArrowUpIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onMoveDown} disabled={index === count - 1} aria-label={t('stocksprite.mappings.rules.moveDown')}>
        <KeyboardArrowDownIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onRemove} aria-label={t('stocksprite.mappings.rules.remove')}>
        <RemoveIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
