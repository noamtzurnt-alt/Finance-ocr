"use client";

type Props = {
  value: string;
  placeholder: string;
  inputMode?: "text" | "decimal" | "numeric";
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
};

export default function ChatInlineInput({
  value,
  placeholder,
  inputMode = "text",
  disabled,
  onChange,
  onSubmit,
  onFocus,
}: Props) {
  return (
    <form
      className="nf-inline-input-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        enterKeyHint="done"
        autoComplete="off"
        className="nf-inline-input"
      />
      <button type="submit" className="nf-inline-submit" disabled={disabled || !value.trim()} aria-label="אישור">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </form>
  );
}
