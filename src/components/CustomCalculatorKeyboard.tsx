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
      if (/[+\-*\/xX:÷−–—×]\s*$/.test(current)) {
        const replaced = current.replace(/[+\-*\/xX:÷−–—×]\s*$/, ` ${key} `);
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
      if (isMathExpression(value)) {
        const ev = evaluateMathExpression(value);
        if (ev !== null && !isNaN(ev) && isFinite(ev)) {
          onChange(formatExpressionWithDots(Math.round(ev).toString()));
          return;
        }
      }
      if (onDone) {
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
    <div className={`w-full bg-[#f3f4f6] select-none ${className}`}>
      {/* Quick Amount Suggestion Chips (Money Lover style bar) */}
      {quickAmounts && quickAmounts.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 overflow-x-auto no-scrollbar border-b border-[#e5e7eb] bg-[#f9fafb]">
          {quickAmounts.map((amt) => (
            <button
              type="button"
              key={amt}
              onClick={() => handleQuickAdd(amt)}
              className="px-2.5 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-xs font-semibold text-gray-700 shrink-0 active:scale-95 transition"
            >
              {formatExpressionWithDots(amt.toString())}
            </button>
          ))}
        </div>
      )}

      {/* Calculator Grid (4 Columns x 5 Rows matching Money Lover) */}
      <div className="grid grid-cols-4 grid-rows-5 gap-px bg-[#d1d5db] touch-manipulation">
        {/* Row 1: C, Operators, Backspace */}
        <button
          type="button"
          onClick={() => handlePress('C')}
          className="h-12 sm:h-14 bg-white text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 font-bold text-2xl flex items-center justify-center transition active:scale-95"
          title="Xóa tất cả (Về 0)"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handlePress('÷')}
          className="h-12 sm:h-14 bg-white text-emerald-700 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          ÷
        </button>
        <button
          type="button"
          onClick={() => handlePress('×')}
          className="h-12 sm:h-14 bg-white text-emerald-700 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => handlePress('BACKSPACE')}
          className="h-12 sm:h-14 bg-white text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-center transition active:scale-95"
          title="Xóa lùi từng số"
        >
          <Delete className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 stroke-[2.2]" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handlePress('7')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handlePress('8')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handlePress('9')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handlePress('−')}
          className="h-12 sm:h-14 bg-white text-emerald-700 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          −
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handlePress('4')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handlePress('5')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handlePress('6')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handlePress('+')}
          className="h-12 sm:h-14 bg-white text-emerald-700 font-bold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          +
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => handlePress('1')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handlePress('2')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handlePress('3')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => handlePress('DONE')}
          className={`row-span-2 text-white flex items-center justify-center transition shadow-xs cursor-pointer select-none ${
            isMathExpression(value)
              ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              : 'bg-[#0284c7] hover:bg-[#0369a1] active:bg-[#075985]'
          }`}
          title={isMathExpression(value) ? 'Tính kết quả (=)' : 'Xong (Tiếp tục)'}
        >
          {isMathExpression(value) ? (
            <span className="text-3xl font-black font-mono leading-none select-none">=</span>
          ) : (
            <ChevronRight className="w-9 h-9 stroke-[3.5]" />
          )}
        </button>

        {/* Row 5 */}
        <button
          type="button"
          onClick={() => handlePress('0')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-semibold text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handlePress('000')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-bold text-lg active:bg-gray-100 flex items-center justify-center transition"
        >
          000
        </button>
        <button
          type="button"
          onClick={() => handlePress('.')}
          className="h-12 sm:h-14 bg-white text-gray-800 font-black text-2xl active:bg-gray-100 flex items-center justify-center transition"
        >
          .
        </button>
      </div>
    </div>
  );
};
