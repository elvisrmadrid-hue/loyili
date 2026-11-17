"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import type { FormState } from "@/lib/forms";
import { formatMoney } from "@/lib/currencies";
import { calculatePoints, formatPoints, type EarningRule } from "@/modules/loyalty/rules";
import { amountExample, maxPurchaseMinor, parseMoneyAmount } from "@/modules/ledger/rules";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { mutedText } from "@/components/ui/styles";

type PurchaseFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  merchantId: string;
  membershipId: string;
  customerName: string;
  currency: string;
  rule: EarningRule;
  branches: { id: string; name: string }[];
  /** New for every page render: the same submission sent twice is recorded once. */
  idempotencyKey: string;
};

const branchStorageKey = (merchantId: string) => `loyili:branch:${merchantId}`;

function readSavedBranch(merchantId: string): string | null {
  try {
    return window.localStorage.getItem(branchStorageKey(merchantId));
  } catch {
    return null; // storage blocked: the cashier simply picks the branch each time
  }
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Amount (+ branch) of a purchase, with a live preview of the points it will give. */
export function PurchaseForm({
  action,
  merchantId,
  membershipId,
  customerName,
  currency,
  rule,
  branches,
  idempotencyKey,
}: PurchaseFormProps) {
  const [amount, setAmount] = useState("");
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  // The Server Action is passed as is, so the form also works before JavaScript loads.
  const [state, formAction] = useActionState(action, undefined);

  // After each successful purchase, clear the amount for the next one. (Adjusting state
  // while rendering when a value changes: https://react.dev/learn/you-might-not-need-an-effect)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.message) setAmount("");
  }

  // The last branch used on this device (a convenience; null on the server or if storage is blocked).
  const savedBranch = useSyncExternalStore(subscribeToStorage, () => readSavedBranch(merchantId), () => null);
  const branchId =
    chosenBranch ?? (savedBranch && branches.some((branch) => branch.id === savedBranch) ? savedBranch : "");

  function chooseBranch(id: string) {
    setChosenBranch(id);
    try {
      window.localStorage.setItem(branchStorageKey(merchantId), id);
    } catch {
      // Ignore: remembering the branch is optional.
    }
  }

  const amountMinor = parseMoneyAmount(amount, currency);
  const preview =
    amount.trim() === ""
      ? null
      : amountMinor === null || amountMinor <= 0
        ? { error: `Escribe el monto como en el ejemplo: ${amountExample(currency)}` }
        : amountMinor > maxPurchaseMinor(currency)
          ? { error: `El monto máximo por compra es ${formatMoney(maxPurchaseMinor(currency), currency)}.` }
          : { points: calculatePoints(amountMinor, rule), amountMinor };

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <TextField
        label={`Monto de la compra (${currency})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder={`Ej.: ${amountExample(currency)}`}
        required
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        errors={state?.fieldErrors?.amount}
      />

      {branches.length > 0 && (
        <SelectField
          label="Sucursal"
          name="branchId"
          required
          options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          placeholder="Elige la sucursal"
          value={branchId}
          onChange={(event) => chooseBranch(event.target.value)}
          errors={state?.fieldErrors?.branchId}
        />
      )}
      {branches.length === 0 && <input type="hidden" name="branchId" value="" />}

      <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900" aria-live="polite">
        {preview === null ? (
          "Escribe el monto para ver cuántos puntos recibirá."
        ) : "error" in preview ? (
          preview.error
        ) : (
          <>
            {customerName} recibirá <strong>{formatPoints(preview.points, currency)}</strong> por esta compra de{" "}
            {formatMoney(preview.amountMinor, currency)}.
          </>
        )}
      </p>
      <p className={mutedText}>Revisa el monto antes de registrar: los puntos se acreditan al instante.</p>

      <SubmitButton pendingText="Registrando…">Registrar compra</SubmitButton>
    </form>
  );
}
