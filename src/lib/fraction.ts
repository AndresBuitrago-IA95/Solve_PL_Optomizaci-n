export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const temp = y;
    y = x % temp;
    x = temp;
  }
  return x || 1;
}

export class Fraction {
  num: number;
  den: number;

  constructor(num = 0, den = 1) {
    if (den === 0) {
      throw new Error("Denominador cero");
    }
    if (!Number.isFinite(num) || !Number.isFinite(den)) {
      this.num = 0;
      this.den = 1;
      return;
    }
    let n = Math.round(num);
    let d = Math.round(den);
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(Math.abs(n), d);
    this.num = n / g;
    this.den = d / g;
  }

  static parse(value: any): Fraction {
    if (value instanceof Fraction) {
      return value.clone();
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return new Fraction(value);
      }
      const s = value.toString();
      const d = s.indexOf('.');
      if (d === -1) {
        return new Fraction(value);
      }
      const dec = s.length - d - 1;
      const den = Math.pow(10, Math.min(dec, 9)); // Prevent overflow
      return new Fraction(Math.round(value * den), den);
    }
    if (typeof value === 'string') {
      let clean = value.trim().replace(/\s+/g, '');
      if (clean === '' || clean === '-') {
        return new Fraction(0);
      }
      if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length === 2) {
          const num = parseInt(parts[0], 10);
          const den = parseInt(parts[1], 10);
          return new Fraction(num, den);
        }
      }
      const parsedFloat = parseFloat(clean);
      if (!isNaN(parsedFloat)) {
        return Fraction.parse(parsedFloat);
      }
    }
    return new Fraction(0);
  }

  static ZERO = new Fraction(0);
  static ONE = new Fraction(1);

  clone(): Fraction {
    return new Fraction(this.num, this.den);
  }

  add(o: any): Fraction {
    const other = Fraction.parse(o);
    return new Fraction(
      this.num * other.den + other.num * this.den,
      this.den * other.den
    );
  }

  sub(o: any): Fraction {
    const other = Fraction.parse(o);
    return new Fraction(
      this.num * other.den - other.num * this.den,
      this.den * other.den
    );
  }

  mul(o: any): Fraction {
    const other = Fraction.parse(o);
    return new Fraction(this.num * other.num, this.den * other.den);
  }

  div(o: any): Fraction {
    const other = Fraction.parse(o);
    if (other.num === 0) {
      throw new Error("División por cero");
    }
    return new Fraction(this.num * other.den, this.den * other.num);
  }

  neg(): Fraction {
    return new Fraction(-this.num, this.den);
  }

  abs(): Fraction {
    return new Fraction(Math.abs(this.num), this.den);
  }

  isZero(): boolean {
    return this.num === 0;
  }

  isNeg(): boolean {
    return this.num < 0;
  }

  isPos(): boolean {
    return this.num > 0;
  }

  eq(o: any): boolean {
    const other = Fraction.parse(o);
    return this.num * other.den === other.num * this.den;
  }

  lt(o: any): boolean {
    const other = Fraction.parse(o);
    return this.num * other.den < other.num * this.den;
  }

  gt(o: any): boolean {
    const other = Fraction.parse(o);
    return this.num * other.den > other.num * this.den;
  }

  le(o: any): boolean {
    return this.lt(o) || this.eq(o);
  }

  ge(o: any): boolean {
    return this.gt(o) || this.eq(o);
  }

  toDecimal(): number {
    return this.num / this.den;
  }

  toString(): string {
    if (this.den === 1) {
      return String(this.num);
    }
    return `${this.num}/${this.den}`;
  }
}
