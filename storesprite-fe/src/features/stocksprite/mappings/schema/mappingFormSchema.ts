import { z } from 'zod';

export interface RuleFormValue {
  op: string;
  params: Record<string, string>;
}

export interface StockMappingFormValue {
  column: string;
  warehouseId: string;
  rules: RuleFormValue[];
}

export interface MappingFormValues {
  name: string;
  enabled: boolean;
  connectionId: string;
  skuField: string;
  skuRules: RuleFormValue[];
  stockMappings: StockMappingFormValue[];
}

export const defaultMappingFormValues: MappingFormValues = {
  name: '',
  enabled: false,
  connectionId: '',
  skuField: '',
  skuRules: [],
  stockMappings: [],
};

export const emptyRuleFormValue = (): RuleFormValue => ({ op: '', params: {} });

export const emptyStockMappingFormValue = (): StockMappingFormValue => ({
  column: '',
  warehouseId: '',
  rules: [],
});

export function createMappingFormSchema(t: (key: string) => string) {
  const ruleSchema = z.object({
    op: z.string().min(1, { message: t('stocksprite.mappings.form.ruleOpRequired') }),
    params: z.record(z.string(), z.string()),
  });

  return z
    .object({
      name: z
        .string()
        .min(1, { message: t('stocksprite.mappings.form.nameRequired') })
        .max(255, { message: t('stocksprite.mappings.form.nameMaxLength') }),
      enabled: z.boolean(),
      connectionId: z.string().min(1, { message: t('stocksprite.mappings.form.connectionRequired') }),
      skuField: z.string(),
      skuRules: z.array(ruleSchema),
      stockMappings: z.array(
        z.object({
          column: z.string().min(1, { message: t('stocksprite.mappings.form.columnRequired') }),
          warehouseId: z.string().min(1, { message: t('stocksprite.mappings.form.warehouseRequired') }),
          rules: z.array(ruleSchema),
        })
      ),
    })
    .superRefine((data, ctx) => {
      if (data.connectionId && !data.skuField.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skuField'],
          message: t('stocksprite.mappings.form.skuRequired'),
        });
      }
    });
}
