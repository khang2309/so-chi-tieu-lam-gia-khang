/**
 * Utility for parsing and evaluating inline mathematical expressions
 * and Vietnamese financial shorthand notations (k, tr, m, củ, tỷ, etc.)
 */

/**
 * Preprocesses a raw string by resolving Vietnamese currency notations
 * (e.g. 50k -> 50000, 2tr5 -> 2500000, 1.5M -> 1500000, 1 tỷ -> 1000000000)
 * and normalizing operators (x, :, ÷, × -> *, /).
 */
export function preprocessMathExpression(raw: string): string {
  if (!raw) return '';
  let text = raw.trim().toLowerCase();

  // 1. Normalize multiplication, division, and minus symbols
  text = text
    .replace(/[×xX]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–—]/g, '-');

  // 2. Thousand separators for pure numbers: e.g. "50.000", "1,000,000"
  // Match groups of 3 digits preceded by dot or comma where it's a thousand separator
  // We avoid replacing decimals in shorthand like "1.5k" or "2,5tr"
  text = text.replace(/(\d{1,3})(?:[.,](\d{3}))+(?!\d)/g, (match) => {
    return match.replace(/[.,]/g, '');
  });

  // 3. Shorthand with combinations like "2tr5" (2 million 500 thousand) or "2k5" (2500)
  text = text.replace(/(\d+)\s*(?:triệu|tr|củ|chai|m)\s*(\d{1,3})(?![a-z0-9])/gi, (_, base, rem) => {
    let remainder = parseInt(rem, 10);
    if (remainder < 10) remainder *= 100_000;
    else if (remainder < 100) remainder *= 10_000;
    else remainder *= 1_000;
    return String(parseInt(base, 10) * 1_000_000 + remainder);
  });

  text = text.replace(/(\d+)\s*k\s*(\d{1,3})(?![a-z0-9])/gi, (_, base, rem) => {
    let remainder = parseInt(rem, 10);
    if (remainder < 10) remainder *= 100;
    else if (remainder < 100) remainder *= 10;
    return String(parseInt(base, 10) * 1_000 + remainder);
  });

  // 4. "rưỡi" notations: e.g. "2tr rưỡi" -> 2.5m
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ|chai|m)\s*rưỡi(?![a-z0-9])/gi, (_, num) => {
    const val = parseFloat(num.replace(',', '.')) + 0.5;
    return String(Math.round(val * 1_000_000));
  });

  // 5. Billions: "tỷ", "ty", "b"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty|b)(?![a-z0-9])/gi, (_, num) => {
    const val = parseFloat(num.replace(',', '.'));
    return String(Math.round(val * 1_000_000_000));
  });

  // 6. Millions: "triệu", "tr", "củ", "chai", "m"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ|chai|m)(?![a-z0-9])/gi, (_, num) => {
    const val = parseFloat(num.replace(',', '.'));
    return String(Math.round(val * 1_000_000));
  });

  // 7. Thousands: "nghìn", "ngàn", "k"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:nghìn|ngàn|k)(?![a-z0-9])/gi, (_, num) => {
    const val = parseFloat(num.replace(',', '.'));
    return String(Math.round(val * 1_000));
  });

  // 8. Replace remaining commas with dots for decimal support
  text = text.replace(/,/g, '.');

  return text;
}

/**
 * Formats numbers within an expression or raw input with dot thousand separators (e.g. 1.204.310).
 * Strictly strips all alphabet characters (a-z, A-Z, Vietnamese characters) so only digits
 * and math operators are allowed.
 */
export function formatExpressionWithDots(raw: string): string {
  if (!raw) return '';
  // 1. Strip all alphabet letters (a-z, A-Z, Vietnamese text)
  let clean = raw.replace(/[a-zA-Zà-ỹÀ-Ỹ]/g, '');
  // Keep only digits, operators (+, -, *, /, x, X, :, ÷, −, –, —, (, )), and dots, commas, spaces
  clean = clean.replace(/[^0-9+\-*\/xX:÷−–—().,\s]/g, '');

  // 2. Format every number group with thousand separator dots
  return clean.replace(/([0-9][0-9.,]*)/g, (match) => {
    const pureDigits = match.replace(/[.,]/g, '');
    if (!pureDigits) return match;
    return pureDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  });
}

/**
 * Checks if the string contains any mathematical operator.
 */
export function isMathExpression(str: string): boolean {
  if (!str) return false;
  return /[+\-*\/()xX:÷−–—]/.test(str);
}

/**
 * Tokenizer & Safe Recursive-Descent Parser for evaluating arithmetic expressions.
 * Grammar:
 *   Expr   := Term (( '+' | '-' ) Term)*
 *   Term   := Factor (( '*' | '/' ) Factor)*
 *   Factor := ( '+' | '-' ) Factor | Primary
 *   Primary:= NUMBER | '(' Expr ')'
 */
class ExpressionParser {
  private tokens: string[] = [];
  private pos = 0;

  constructor(expression: string) {
    this.tokenize(expression);
  }

  private tokenize(str: string) {
    const regex = /\s*([0-9]+(?:\.[0-9]+)?|[+\-*\/()]|[^0-9\s+\-*\/()]+)\s*/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
      if (match[1]) {
        this.tokens.push(match[1]);
      }
    }
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos++] : null;
  }

  public parse(): number | null {
    if (this.tokens.length === 0) return null;
    try {
      const val = this.parseExpr();
      if (this.pos < this.tokens.length) {
        // Unexpected trailing tokens
        return null;
      }
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return Math.round(val * 100) / 100; // Round to 2 decimal places max
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseExpr(): number {
    let result = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume();
      const right = this.parseTerm();
      if (op === '+') result += right;
      else result -= right;
    }
    return result;
  }

  private parseTerm(): number {
    let result = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.consume();
      const right = this.parseFactor();
      if (op === '*') {
        result *= right;
      } else {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      }
    }
    return result;
  }

  private parseFactor(): number {
    const next = this.peek();
    if (next === '+') {
      this.consume();
      return this.parseFactor();
    }
    if (next === '-') {
      this.consume();
      return -this.parseFactor();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token === '(') {
      this.consume(); // '('
      const val = this.parseExpr();
      if (this.consume() !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      return val;
    }

    const num = parseFloat(token);
    if (!isNaN(num)) {
      this.consume();
      return num;
    }

    throw new Error(`Invalid token: ${token}`);
  }
}

/**
 * Evaluates a string math expression, returning the resulting number, or null if invalid.
 * Examples:
 *   evaluateMathExpression("50000 + 25000") -> 75000
 *   evaluateMathExpression("50k + 20k") -> 70000
 *   evaluateMathExpression("120k / 2") -> 60000
 *   evaluateMathExpression("45k * 3") -> 135000
 *   evaluateMathExpression("2tr5 - 500k") -> 2000000
 */
export function evaluateMathExpression(input: string): number | null {
  if (!input || !input.trim()) return null;
  const processed = preprocessMathExpression(input);
  if (!processed) return null;
  const parser = new ExpressionParser(processed);
  return parser.parse();
}

/**
 * Evaluates a math expression if valid, or extracts a standard numeric float,
 * returning a fallback number (default 0) if neither is valid.
 */
export function parseAmountOrExpression(input: string, fallback = 0): number {
  if (!input || !input.trim()) return fallback;
  const evalResult = evaluateMathExpression(input);
  if (evalResult !== null && !isNaN(evalResult) && isFinite(evalResult)) {
    return evalResult;
  }
  const cleanStr = input.replace(/\./g, '').replace(/[^0-9-]/g, '');
  const parsed = parseFloat(cleanStr);
  return !isNaN(parsed) && isFinite(parsed) ? parsed : fallback;
}
