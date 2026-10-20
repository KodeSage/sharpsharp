export type ParsedItem = {
  name: string;
  price: number;
};

/**
 * Parse a pasted WhatsApp catalog into structured items.
 * Pure function — no AI, no network.
 *
 * Rules:
 * - Split by newlines; skip empty lines and lines with no detectable price.
 * - Strip leading emojis, bullets (•, -, *), and list numbering ("1.", "1)").
 * - Detect price anywhere on the line. Supported formats:
 *     ₦2,500  N2500  NGN 2500  2,500  2500  2.5k  4k  4K  1.2m
 *   "k" = ×1000, "m" = ×1,000,000.
 * - If several numbers appear, use the LAST one that looks like a price.
 * - Name = the line with the price token and separators (–, -, :, =, @, "for") removed, trimmed.
 */
export function parseCatalog(text: string): ParsedItem[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const items: ParsedItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const parsed = parseLine(line);
    if (parsed) items.push(parsed);
  }

  return items;
}

function parseLine(line: string): ParsedItem | null {
  // Find all candidate price tokens in the line.
  const candidates = findPriceCandidates(line);
  if (candidates.length === 0) return null;

  // Use the LAST price-looking number on the line.
  const priceInfo = candidates[candidates.length - 1];

  // Build the name: remove the matched price token, then strip separators.
  let name = line;
  // Remove the specific matched substring (by index).
  name = name.slice(0, priceInfo.start) + name.slice(priceInfo.end);
  // Remove separators and trailing connector words.
  name = stripSeparators(name);
  // Strip leading emojis/bullets/numbering.
  name = stripLeadingJunk(name);
  name = name.trim();

  // Clean up leftover artifacts: multiple spaces, dangling punctuation.
  name = name.replace(/\s{2,}/g, ' ').replace(/[\s\-–—:|=]+$/g, '').trim();

  if (!name) {
    // If the name is empty after cleanup, use a generic label so we don't lose the item.
    name = 'Untitled item';
  }

  return { name, price: priceInfo.value };
}

type PriceCandidate = { value: number; start: number; end: number };

const PRICE_REGEX =
  /(?:₦|N|NGN|ngn)?\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m|K|M)?(?:\s?(?:naira|Naira|NAIRA))?(?=\s|$|[^a-zA-Z0-9])/g;

function findPriceCandidates(line: string): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  let match: RegExpExecArray | null;
  PRICE_REGEX.lastIndex = 0;
  while ((match = PRICE_REGEX.exec(line)) !== null) {
    const rawNum = match[1].replace(/,/g, '');
    let value = parseFloat(rawNum);
    if (isNaN(value) || value <= 0) continue;

    const suffix = match[2];
    if (suffix) {
      const s = suffix.toLowerCase();
      if (s === 'k') value *= 1000;
      else if (s === 'm') value *= 1_000_000;
    }

    // Only accept if it looks like a price, not a quantity in parens like "(20pcs)".
    // Heuristic: skip numbers that are immediately preceded by "(" and followed by "pcs"/"pc"/"pieces".
    const before = line.slice(0, match.index);
    const after = line.slice(match.index + match[0].length);
    if (/\(\s*$/.test(before) && /^\s*(pcs|pc|pieces|pieces)/i.test(after)) {
      continue;
    }

    // Round to nearest naira (no kobo in catalogs).
    value = Math.round(value);

    candidates.push({
      value,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return candidates;
}

function stripSeparators(name: string): string {
  // Remove connector separators and the word "for" when used as a price connector.
  return name
    .replace(/\s+for\s+/gi, ' ')
    .replace(/\s+for$/gi, '')
    .replace(/[–—]/g, '-')
    .replace(/\s*[:=@]\s*/g, ' ')
    .replace(/\s*-\s*/g, ' ');
}

function stripLeadingJunk(name: string): string {
  let s = name;
  // Strip leading emojis (common ranges) and misc symbols.
  s = s.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]+/gu, '');
  // Strip leading bullets / dashes / dots.
  s = s.replace(/^[•·*\-–—.]+\s*/u, '');
  // Strip leading list numbering: "1. ", "1) ", "1) ", "10. "
  s = s.replace(/^\d+\s*[.)]\s*/u, '');
  return s;
}

/* ------------------------------------------------------------------ */
/* Tests — run with: npx tsx src/lib/parseCatalog.test.ts             */
/* (kept inline as a comment block for quick reference)               */
/* ------------------------------------------------------------------ */

/*
import assert from 'node:assert';

function eq(actual: ParsedItem[], expected: ParsedItem[]) {
  assert.strictEqual(actual.length, expected.length, 'length mismatch');
  for (let i = 0; i < actual.length; i++) {
    assert.strictEqual(actual[i].name, expected[i].name, `name[${i}]`);
    assert.strictEqual(actual[i].price, expected[i].price, `price[${i}]`);
  }
}

const cases: [string, ParsedItem[]][] = [
  ['🍛 Jollof rice pack – ₦2,500', [{ name: 'Jollof rice pack', price: 2500 }]],
  ['Fried rice + chicken: 3500', [{ name: 'Fried rice + chicken', price: 3500 }]],
  ['Small chops (20pcs) 4k', [{ name: 'Small chops (20pcs)', price: 4000 }]],
  ['Zobo 1L - N1,200', [{ name: 'Zobo 1L', price: 1200 }]],
  [' Ankara gown for 12,500', [{ name: 'Ankara gown', price: 12500 }]],
  ['1. Suya plate = 2.5k', [{ name: 'Suya plate', price: 2500 }]],
  ['2) Pepper soup 1.2m', [{ name: 'Pepper soup', price: 1200000 }]],
  ['NGN 2500 Designer bag', [{ name: 'Designer bag', price: 2500 }]],
  ['Hair cut - 3,000 naira', [{ name: 'Hair cut', price: 3000 }]],
  ['', []],
  ['No price here', []],
  ['Just a note (5pcs)', []],
];

for (const [input, expected] of cases) {
  eq(parseCatalog(input), expected);
}
console.log('All parseCatalog tests passed ✅');
*/
