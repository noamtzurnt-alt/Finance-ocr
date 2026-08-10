import { z } from "zod";

const expenseRowSchema = z.object({
  id: z.string(),
  icon: z.string(),
  label: z.string(),
  amount: z.string(),
  isFixed: z.boolean(),
  notes: z.string().optional(),
});

export const wizardStateSchema = z.object({
  answers: z.object({
    incomeSources: z.object({
      steady: z.boolean(),
      variable: z.boolean(),
      other: z.boolean(),
    }),
    salaryIncome: z.string(),
    businessIncome: z.string(),
    otherIncome: z.string(),
    monthlySavings: z.string(),
    expenseRows: z.array(expenseRowSchema),
    businessExpenseRows: z.array(expenseRowSchema),
  }),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  done: z.boolean(),
});

export type WizardPersistedState = z.infer<typeof wizardStateSchema>;

export function parseWizardState(value: unknown): WizardPersistedState | null {
  const parsed = wizardStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
