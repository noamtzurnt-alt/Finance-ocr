"use client";

import { CHAT_PAYMENT_OPTIONS } from "@/app/lib/transactions/chat-payment";

export type TxEditDraft = {
  transactionId: string;
  index: number;
  vendor: string;
  amount: string;
  payment: string;
  description: string;
  date: string;
  categoryId: string;
  categoryName: string | null;
  categories: { id: string; name: string }[];
};

type Props = {
  draft: TxEditDraft;
  disabled?: boolean;
  busy?: boolean;
  onChange: (patch: Partial<TxEditDraft>) => void;
  onSave: () => void;
  onBack: () => void;
};

export default function ChatTxEditCard({ draft, disabled, busy, onChange, onSave, onBack }: Props) {
  const locked = Boolean(disabled || busy);
  const knownPayments = CHAT_PAYMENT_OPTIONS.filter((option) => option.id !== "other");
  const paymentKnown = !draft.payment || knownPayments.some((option) => option.value === draft.payment);
  const categoryKnown =
    !draft.categoryId || draft.categories.some((category) => category.id === draft.categoryId);

  return (
    <form
      className="nf-tx-edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked) onSave();
      }}
    >
      <p className="nf-tx-edit-kicker">תנועה {draft.index}</p>

      <label className="nf-tx-edit-field">
        <span>שם התנועה</span>
        <input
          value={draft.vendor}
          disabled={locked}
          maxLength={120}
          onChange={(e) => onChange({ vendor: e.target.value })}
        />
      </label>

      <label className="nf-tx-edit-field">
        <span>סכום</span>
        <input
          value={draft.amount}
          disabled={locked}
          inputMode="decimal"
          onChange={(e) => onChange({ amount: e.target.value })}
        />
      </label>

      <label className="nf-tx-edit-field">
        <span>אמצעי תשלום</span>
        <select
          value={draft.payment}
          disabled={locked}
          onChange={(e) => onChange({ payment: e.target.value })}
        >
          <option value="">ללא תשלום</option>
          {!paymentKnown ? <option value={draft.payment}>{draft.payment}</option> : null}
          {knownPayments.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="nf-tx-edit-field">
        <span>תיאור</span>
        <input
          value={draft.description}
          disabled={locked}
          maxLength={240}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>

      <label className="nf-tx-edit-field">
        <span>תאריך</span>
        <input
          type="date"
          value={draft.date}
          disabled={locked}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </label>

      <label className="nf-tx-edit-field">
        <span>קטגוריה</span>
        <select
          value={draft.categoryId}
          disabled={locked}
          onChange={(e) => onChange({ categoryId: e.target.value })}
        >
          <option value="">ללא קטגוריה</option>
          {!categoryKnown && draft.categoryName ? (
            <option value={draft.categoryId}>{draft.categoryName}</option>
          ) : null}
          {draft.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <div className="nf-tx-edit-actions">
        <button type="button" className="nf-tx-edit-back" disabled={locked} onClick={onBack}>
          חזרה לתפריט
        </button>
        <button type="submit" className="nf-tx-edit-save" disabled={locked} aria-label="שמירה">
          ✓
        </button>
      </div>
    </form>
  );
}
