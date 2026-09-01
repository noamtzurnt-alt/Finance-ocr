"use client";

import type { MenuOption } from "@/app/lib/transactions/chat-menu";

type Props = {
  options: MenuOption[];
  disabled?: boolean;
  onPick: (option: MenuOption) => void;
};

export default function ChatMenuButtons({ options, disabled, onPick }: Props) {
  return (
    <div className="nf-payment-options">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="nf-payment-option"
          disabled={disabled}
          onClick={() => onPick(option)}
        >
          <span className="nf-payment-option-label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
