import type { BankAccountId, BankInstitutionId } from "./types";

export const BANK_INSTITUTION_OPTIONS: {
  id: BankInstitutionId;
  label: string;
}[] = [
  { id: "finom", label: "Finom" },
  { id: "bper", label: "BPER" },
];

/** Conti operativi: quali istituti usi per ogni società/conto dashboard. */
export const BANK_LEDGER_MATRIX: Record<
  BankAccountId,
  BankInstitutionId[]
> = {
  dsep: ["finom", "bper"],
  hsp: ["bper"],
  dd: ["finom"],
};

export function getInstitutionsForAccount(
  accountId: BankAccountId,
): BankInstitutionId[] {
  return BANK_LEDGER_MATRIX[accountId] ?? BANK_INSTITUTION_OPTIONS.map((i) => i.id);
}

export function getBankInstitutionLabel(id: BankInstitutionId): string {
  return (
    BANK_INSTITUTION_OPTIONS.find((option) => option.id === id)?.label ?? id
  );
}

export function isInstitutionAllowedForAccount(
  accountId: BankAccountId,
  institutionId: BankInstitutionId,
): boolean {
  return getInstitutionsForAccount(accountId).includes(institutionId);
}
