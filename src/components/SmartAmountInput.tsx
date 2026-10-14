import React, { useState, useEffect, useRef } from 'react';
import {
  evaluateMathExpression,
  isMathExpression,
  formatExpressionWithDots,
} from '../utils/mathExpression';
import { formatCurrency } from '../utils/formatters';
import { Calculator } from 'lucide-react';

interface SmartAmountInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluated?: (num: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  size?: 'large' | 'normal' | 'compact';
  currencySymbol?: string;
  id?: string;
}

export const SmartAmountInput: React.FC<SmartAmountInputProps> = ({
  value,
  onChange,
  onEvaluated,
  placeholder = '0',
  className = '',
  autoFocus = false,
  size = 'normal',
  currencySymbol = '₫',
  id,
}) => {
  const [internalValue, setInternalValue] = useState(() =>
    formatExpressionWithDots(value || '')
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    if (value !== undefined) {
      const formatted = formatExpressionWithDots(value.toString());
      setInternalValue(formatted);
    }
  }, [value]);

  // Compute live evaluated result
  const evaluated = evaluateMathExpression(internalValue);
  const hasExpression = isMathExpression(internalValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cursorPos = e.target.selectionStart || rawVal.length;

    // Count how many allowed meaningful characters were before the cursor
    const rawBeforeCursor = rawVal.slice(0, cursorPos);
    const nonFormatCharsBefore = (rawBeforeCursor.match(/[0-9+\-*\/xX:÷()]/g) || []).length;

    // Format with dots every 3 digits and strictly strip all letters
    const formatted = formatExpressionWithDots(rawVal);
    setInternalValue(formatted);
    onChange(formatted);

    const ev = evaluateMathExpression(formatted);
    if (ev !== null && onEvaluated) {
      onEvaluated(ev);
    }

    // Preserve cursor position naturally
    requestAnimationFrame(() => {
      if (inputRef.current) {
        let count = 0;
        let newPos = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
          if (/[0-9+\-*\/xX:÷()]/.test(formatted[i])) {
            count++;
            if (count === nonFormatCharsBefore) {
              newPos = i + 1;
              break;
            }
          }
        }
        if (nonFormatCharsBefore === 0) {
          newPos = 0;
        }
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  const handleBlur = () => {
    if (evaluated !== null && hasExpression) {
      const resolvedFormatted = formatExpressionWithDots(Math.round(evaluated).toString());
      setInternalValue(resolvedFormatted);
      onChange(resolvedFormatted);
      if (onEvaluated) onEvaluated(evaluated);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (evaluated !== null && hasExpression) {
        e.preventDefault();
        const resolvedFormatted = formatExpressionWithDots(Math.round(evaluated).toString());
        setInternalValue(resolvedFormatted);
        onChange(resolvedFormatted);
        if (onEvaluated) onEvaluated(evaluated);
      }
    }
  };

  const baseInputStyle =
    size === 'large'
      ? 'text-2xl font-bold font-sans px-4 py-2.5 rounded-xl'
      : size === 'compact'
      ? 'text-xs font-semibold px-2.5 py-1.5 rounded-lg'
      : 'text-sm font-semibold px-3 py-2 rounded-xl';

  return (
    <div className="space-y-1 w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={internalValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`w-full bg-[#fbf5eb] border border-[#ebdcc9] text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none transition ${baseInputStyle} ${
            currencySymbol ? 'pr-8' : ''
          } ${className}`}
        />

        {currencySymbol && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#7a6a58] pointer-events-none select-none">
            {currencySymbol}
          </span>
        )}
      </div>

      {/* Live evaluated preview badge when an expression is entered */}
      {hasExpression && evaluated !== null && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#2e7d32]/10 border border-[#2e7d32]/20 text-[#2e7d32] text-xs font-semibold animate-in fade-in duration-100">
          <Calculator className="w-3.5 h-3.5 shrink-0" />
          <span>= {formatCurrency(Math.round(evaluated))}</span>
          <span className="text-[10px] text-[#7a6a58] ml-auto font-normal">
            (Bấm Enter hoặc chạm ra ngoài để tính)
          </span>
        </div>
      )}
    </div>
  );
};
