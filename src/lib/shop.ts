export type SavedShop = { slug: string; token: string };

const STORAGE_KEY = 'sharpsharp:shop';

export function saveShop(slug: string, token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ slug, token }));
  } catch {
    // localStorage may be unavailable (private mode, etc.) — silently ignore.
  }
}

export function getSavedShop(): SavedShop | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedShop;
    if (parsed && typeof parsed.slug === 'string' && typeof parsed.token === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSavedShop(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Normalize a WhatsApp number to digits-only international format.
 *
 * Accepts: 08031234567, +2348031234567, 2348031234567, 803 123 4567
 * Rules:
 *   - Strip all non-digits.
 *   - If it starts with 0 and is 11 digits → replace leading 0 with 234.
 *   - If it starts with 234 and is 13 digits → keep as is.
 *   - Otherwise keep as-is if 10–15 digits.
 *
 * Returns { digits, display, valid }.
 */
export function normalizeWhatsapp(input: string): {
  digits: string;
  display: string;
  valid: boolean;
} {
  const digits = input.replace(/\D/g, '');

  let normalized = digits;
  if (digits.length === 11 && digits.startsWith('0')) {
    normalized = '234' + digits.slice(1);
  } else if (digits.length === 13 && digits.startsWith('234')) {
    normalized = digits;
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    // e.g. 8031234567 → assume Nigeria
    normalized = '234' + digits;
  }

  // Validate: 13 digits starting with 234, OR any 10–15 digit international number.
  const isNigeriaValid = normalized.length === 13 && normalized.startsWith('234');
  const isIntlValid = normalized.length >= 10 && normalized.length <= 15;
  const valid = isNigeriaValid || isIntlValid;

  const display = formatDisplay(normalized);

  return { digits: normalized, display, valid };
}

function formatDisplay(digits: string): string {
  if (digits.length === 13 && digits.startsWith('234')) {
    const rest = digits.slice(3); // 803 123 4567
    return `+234 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  if (digits.length > 6) {
    // Generic grouping: +X XXX XXX XXXX
    return '+' + digits;
  }
  return '+' + digits;
}
