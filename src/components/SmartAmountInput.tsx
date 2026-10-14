import React, { useState, useEffect, useRef } from 'react';
import { evaluateMathExpression, isMathExpression } from '../utils/mathExpression';
import { formatCurrency } from '../utils/formatters';
import { Calculator } from 'lucide-react';

interface SmartAmountInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluated?: (num: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  showQuickOperators?: boolean;
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
  showQuickOperators = false,
  size = 'normal',
  currencySymbol = '₫',
  id,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Compute live evaluated result
  const evaluated = evaluateMathExpression(internalValue);
  const hasExpression = isMathExpression(internalValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    onChange(val);

    const ev = evaluateMathExpression(val);
    if (ev !== null && onEvaluated) {
      onEvaluated(ev);
    }
  };

  const handleBlur = () => {
    if (evaluated !== null && hasExpression) {
      const resolvedStr = evaluated.toString();
      setInternalValue(resolvedStr);
      onChange(resolvedStr);
      if (onEvaluated) onEvaluated(evaluated);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (evaluated !== null && hasExpression) {
        e.preventDefault();
        const resolvedStr = evaluated.toString();
        setInternalValue(resolvedStr);
        onChange(resolvedStr);
        if (onEvaluated) onEvaluated(evaluated);
      }
    }
  };

  const appendOperator = (op: string) => {
    const current = internalValue.trim();
    let next = '';
    if (['+', '-', '*', '/'].includes(op)) {
      next = current ? `${current} ${op} ` : op;
    } else {
      next = `${current}${op}`;
    }
    setInternalValue(next);
    onChange(next);
    const ev = evaluateMathExpression(next);
    if (ev !== null && onEvaluated) {
      onEvaluated(ev);
    }
    inputRef.current?.focus();
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
          inputMode="text"
          value={internalValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
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
          <span>= {formatCurrency(evaluated)}</span>
          <span className="text-[10px] text-[#7a6a58] ml-auto font-normal">
            (Bấm Enter hoặc chạm ra ngoài để tính)
          </span>
        </div>
      )}

      {/* Quick math operator buttons on mobile/desktop */}
      {showQuickOperators && (
        <div className="flex items-center gap-1 pt-0.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[10px] text-[#7a6a58] font-medium mr-1 shrink-0 flex items-center gap-0.5">
            <Calculator className="w-3 h-3 text-[#a25832]" />
            Tính:
          </span>
          {[
            { label: '+', val: '+' },
            { label: '-', val: '-' },
            { label: '×', val: '*' },
            { label: '÷', val: '/' },
            { label: 'k (nghìn)', val: 'k' },
            { label: 'M (triệu)', val: 'M' },
            { label: '(', val: '(' },
            { label: ')', val: ')' },
          ].map((op) => (
            <button
              type="button"
              key={op.label}
              onClick={() => appendOperator(op.val)}
              className="px-2 py-0.5 rounded-md bg-[#f5ebe0] hover:bg-[#ebdcc9] text-xs font-bold text-[#3e332a] border border-[#ebdcc9] active:scale-95 transition shrink-0"
            >
              {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
