import React from 'react';
import { Delete, ChevronRight } from 'lucide-react';
import {
  formatExpressionWithDots,
  evaluateMathExpression,
  isMathExpression,
  parseAmountOrExpression,
} from '../utils/mathExpression';

interface CustomCalculatorKeyboardProps {
  value: string;
  onChange: (newValue: string) => void;
  onDone?: () => void;
  quickAmounts?: number[];
  className?: string;
}

export const CustomCalculatorKeyboard: React.FC<CustomCalculatorKeyboardProps> = ({
  value,
  onChange,
  onDone,
  quickAmounts = [10000, 20000, 30000, 50000, 100000, 200000, 500000, 1000000],
  className = '',
}) => {
  const handlePress = (key: string) => {
    if (key === 'C') {
      onChange('0');
      return;
    }

    if (key === 'BACKSPACE') {
      if (!value || value === '0') return;
      const trimmed = value.trimEnd();
      if (/[+\-*\/×÷−–—]\s*$/.test(trimmed)) {
        const next = trimmed.replace(/[+\-*\/×÷−–—]\s*$/, '').trimEnd();
        onChange(formatExpressionWithDots(next) || '0');
      } else {
        const sliced = trimmed.slice(0, -1);
        const formatted = formatExpressionWithDots(sliced) || '0';
        onChange(formatted);
      }
      return;
    }

    if (key === '000') {
      if (!value || value === '0') return;
      const next = `${value}000`;
      onChange(formatExpressionWithDots(next));
      return;
    }

    if (['+', '−', '×', '÷'].includes(key)) {
      const current = (value || '0').trimEnd();
      if (/[+\-*\/xX:÷−–—]\s*$/.test(current)) {
        const replaced = current.replace(/[+\-*\/xX:÷−–—]\s*$/, ` ${key} `);
        onChange(replaced);
      } else {
        onChange(`${current} ${key} `);
      }
      return;
    }

    if (key === '.') {
      const current = (value || '0').trimEnd();
      if (!current.endsWith('.')) {
        onChange(`${current}.`);
      }
      return;
    }

    if (key === 'DONE') {
      const ev = evaluateMathExpression(value);
      if (ev !== null && isMathExpression(value)) {
        onChange(formatExpressionWithDots(Math.round(ev).toString()));
      } else if (onDone) {
        onDone();
      }
      return;
    }

    // Digits 0-9
    if (/^[0-9]$/.test(key)) {
      let next = '';
      if (!value || value === '0') {
        next = key;
      } else {
        next = `${value}${key}`;
      }
      onChange(formatExpressionWithDots(next));
    }
  };

  const handleQuickAdd = (addVal: number) => {
    const trimmed = (value || '').trim();
    if (/[+\-*\/xX:÷−–—]\s*$/.test(trimmed)) {
      onChange(formatExpressionWithDots(`${trimmed} ${addVal}`));
      return;
    }
    const currentNum = parseAmountOrExpression(value, 0);
    if (!currentNum || currentNum === 0) {
      onChange(formatExpressionWithDots(addVal.toString()));
    } else {
      const newTotal = currentNum + addVal;
      onChange(formatExpressionWithDots(newTotal.toString()));
    }
  };

  return (
    <div className={`w-full bg-[#f3f4f6] border-t border-[#e5e7eb] select-none ${className}`}>
      {/* Quick Amount Suggestion Chips (Money Lover style bar) */}
      {quickAmounts && quickAmounts.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 overflow-x-auto no-scrollbar border-b border-[#e5e7eb] bg-[#f9fafb]">
          {quickAmounts.map((amt) => (
            <button
              type="button"
              key={amt}
              onClick={() => handleQuickAdd(amt)}
              className="px-3 py-1 rounded-sm bg-white hover:bg-[#f3f4f6] border border-[#d1d5db] text-xs font-semibold text-gray-700 shrink-0 active:scale-95 transition shadow-2xs"
            >
              {formatExpressionWithDots(amt.toString())}
            </button>
          ))}
        </div>
      )}

      {/* Calculator Grid (4 Columns x 5 Rows matching media_1791982056535_a8d46179.jpg) */}
      <div className="grid grid-cols-4 grid-rows-5 gap-px bg-[#e5e7eb] touch-manipulation">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => handlePress('C')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-xl active:bg-gray-100 flex items-center justify-center transition"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handlePress('÷')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          ÷
        </button>
        <button
          type="button"
          onClick={() => handlePress('×')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => handlePress('BACKSPACE')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold active:bg-gray-100 flex items-center justify-center transition"
          title="Xóa ký tự trước"
        >
          <Delete className="w-6 h-6 text-emerald-600" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handlePress('7')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handlePress('8')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handlePress('9')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handlePress('−')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          −
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handlePress('4')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handlePress('5')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handlePress('6')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handlePress('+')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          +
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => handlePress('1')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handlePress('2')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handlePress('3')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => handlePress('DONE')}
          className="row-span-2 bg-[#0284c7] hover:bg-[#0369a1] active:bg-[#075985] text-[#0f172a] flex items-center justify-center transition shadow-xs"
          title="Tính hoặc Hoàn tất"
        >
          <ChevronRight className="w-9 h-9 stroke-[3]" />
        </button>

        {/* Row 5 */}
        <button
          type="button"
          onClick={() => handlePress('0')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handlePress('000')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-lg active:bg-gray-100 flex items-center justify-center transition"
        >
          000
        </button>
        <button
          type="button"
          onClick={() => handlePress('.')}
          className="h-13 sm:h-14 bg-white text-emerald-600 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          .
        </button>
      </div>
    </div>
  );
};
