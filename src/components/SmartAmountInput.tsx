import React, { useState, useEffect, useRef } from 'react';
import {
  evaluateMathExpression,
  isMathExpression,
  formatExpressionWithDots,
} from '../utils/mathExpression';
import { formatCurrency } from '../utils/formatters';
import { Calculator, X } from 'lucide-react';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';

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
  disableKeypadModal?: boolean;
  onClick?: () => void;
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
  disableKeypadModal = false,
  onClick,
}) => {
  const [internalValue, setInternalValue] = useState(() =>
    formatExpressionWithDots(value || '')
  );
  const [showKeypadModal, setShowKeypadModal] = useState<boolean>(false);
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
    const nonFormatCharsBefore = (rawBeforeCursor.match(/[0-9+\-*\/xX:÷−–—()]/g) || []).length;

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
          if (/[0-9+\-*\/xX:÷−–—()]/.test(formatted[i])) {
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

  const handleClickInput = () => {
    if (onClick) {
      onClick();
    }
    if (!disableKeypadModal) {
      setShowKeypadModal(true);
    }
  };

  const handleKeypadChange = (newVal: string) => {
    setInternalValue(newVal);
    onChange(newVal);
    const ev = evaluateMathExpression(newVal);
    if (ev !== null && onEvaluated) {
      onEvaluated(ev);
    }
  };

  const handleKeypadDone = () => {
    const ev = evaluateMathExpression(internalValue);
    if (ev !== null) {
      const resolved = formatExpressionWithDots(Math.round(ev).toString());
      setInternalValue(resolved);
      onChange(resolved);
      if (onEvaluated) onEvaluated(ev);
    }
    setShowKeypadModal(false);
  };

  const baseInputStyle =
    size === 'large'
      ? 'text-2xl font-bold font-sans px-4 py-2.5 rounded-xl'
      : size === 'compact'
      ? 'text-xs font-semibold px-2.5 py-1.5 rounded-lg'
      : 'text-sm font-semibold px-3 py-2 rounded-xl';

  return (
    <div className="space-y-1 w-full relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="none"
          value={internalValue}
          onChange={handleInputChange}
          onClick={handleClickInput}
          onFocus={handleClickInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`w-full bg-[#fbf5eb] border border-[#ebdcc9] text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none transition cursor-pointer ${baseInputStyle} ${
            currencySymbol ? 'pr-16' : 'pr-9'
          } ${className}`}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 select-none">
          {currencySymbol && (
            <span className="text-xs font-semibold text-[#7a6a58] pointer-events-none">
              {currencySymbol}
            </span>
          )}
          {!disableKeypadModal && (
            <button
              type="button"
              onClick={() => setShowKeypadModal(true)}
              className="p-1 rounded-md text-[#a25832] hover:bg-[#ebdcc9] active:scale-95 transition"
              title="Mở bàn phím số & máy tính"
            >
              <Calculator className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Live evaluated preview badge when an expression is entered */}
      {hasExpression && evaluated !== null && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#2e7d32]/10 border border-[#2e7d32]/20 text-[#2e7d32] text-xs font-semibold animate-in fade-in duration-100">
          <Calculator className="w-3.5 h-3.5 shrink-0" />
          <span>= {formatCurrency(Math.round(evaluated))}</span>
        </div>
      )}

      {/* Modal/Bottom Sheet for Calculator Keypad */}
      {showKeypadModal && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => handleKeypadDone()}
          />
          <div className="relative z-10 w-full max-w-lg mx-auto bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Keypad Sheet Header: Amount Display */}
            <div className="px-4 py-3 bg-[#f8fafc] border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wide">
                  VND
                </span>
                <span className="text-2xl font-bold text-emerald-600 truncate max-w-[240px]">
                  {internalValue || '0'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleKeypadDone()}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Calculator Keypad */}
            <CustomCalculatorKeyboard
              value={internalValue}
              onChange={handleKeypadChange}
              onDone={handleKeypadDone}
            />
          </div>
        </div>
      )}
    </div>
  );
};
