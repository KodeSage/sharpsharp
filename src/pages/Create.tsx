import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, Plus, CheckCircle2, AlertCircle, Sparkles, Trash2 } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { saveShop, normalizeWhatsapp } from '@/lib/shop';
import { parseCatalog, type ParsedItem } from '@/lib/parseCatalog';
import { itemDropVariants, prefersReducedMotion } from '@/lib/motion';
import { buzz } from '@/lib/buzz';
import {
  CATEGORIES,
  BRAND_COLORS,
  inputClass,
  Field,
  friendlyError,
  type EditableItem,
} from '@/components/ShopForm';

/* ---------- Tea cup SVG with steam ---------- */
function TeaCup({ steamOpacity }: { steamOpacity: number }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Steam wisps */}
      <g opacity={steamOpacity} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M8 2c0 1-1 1.5-1 2.5S8 5.5 8 6.5" />
        <path d="M12 1c0 1-1 1.5-1 2.5S12 4.5 12 5.5" />
        <path d="M16 2c0 1-1 1.5-1 2.5S16 5.5 16 6.5" />
      </g>
      {/* Cup */}
      <path d="M4 9h13v5a4 4 0 01-4 4H8a4 4 0 01-4-4V9z" fill="currentColor" opacity="0.9" />
      {/* Handle */}
      <path d="M17 10h2a2 2 0 010 4h-2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Saucer */}
      <rect x="3" y="19" width="15" height="2" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/* ---------- Stopwatch pill ---------- */
function StopwatchPill({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  // Steam opacity: 1 at 0s, 0.3 at 60s, 0 at 120s
  const steamOpacity = Math.max(0, 1 - seconds / 120);

  return (
    <div className="sticky top-16 z-20 mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 shadow-soft">
      <span className="text-ink">
        <TeaCup steamOpacity={steamOpacity} />
      </span>
      <span className="text-sm font-bold tabular-nums text-ink">{timeStr}</span>
    </div>
  );
}

/* ---------- Rolling count ---------- */
function RollingCount({ target }: { target: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toString());
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target.toString());
      return;
    }
    const controls = animate(count, target, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v).toString()),
    });
    return () => controls.stop();
  }, [target, count]);

  return <span className="tabular-nums">{display}</span>;
}

/* ---------- Parse with unparsed lines ---------- */
function parseWithUnparsed(text: string): { items: ParsedItem[]; unparsed: string[] } {
  const lines = text.split(/\r?\n/);
  const items: ParsedItem[] = [];
  const unparsed: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parsed = parseCatalog(line);
    if (parsed.length > 0) {
      items.push(...parsed);
    } else {
      // Strip basic leading junk for display
      const cleaned = line
        .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+\s*/u, '')
        .replace(/^[•·*\-–—.]+\s*/u, '')
        .replace(/^\d+\s*[.)]\s*/u, '')
        .trim();
      if (cleaned.length > 1) {
        unparsed.push(cleaned);
      }
    }
  }
  return { items, unparsed };
}

let itemIdCounter = 0;
function makeItemId(): string {
  itemIdCounter += 1;
  return `local-${Date.now()}-${itemIdCounter}`;
}

function toEditable(parsed: ParsedItem[]): EditableItem[] {
  return parsed.map((p) => ({
    id: makeItemId(),
    name: p.name,
    price: p.price,
    available: true,
  }));
}

/* ---------- Main component ---------- */
export default function Create() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stopwatch
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Form state
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [hours, setHours] = useState('');
  const [brandColor, setBrandColor] = useState('#FF5A1F');
  const [tagline, setTagline] = useState('');
  const [catalogText, setCatalogText] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);

  const whatsappResult = useMemo(() => normalizeWhatsapp(whatsapp), [whatsapp]);
  const { items: parsedItems, unparsed } = useMemo(
    () => parseWithUnparsed(catalogText),
    [catalogText]
  );

  const nameValid = shopName.trim().length >= 2;
  const whatsappValid = whatsappResult.valid;
  const canSubmit = nameValid && whatsappValid && category !== '' && !submitting;

  // Track previous item count to detect new paste
  const prevItemCountRef = useRef(0);
  const hasPastedRef = useRef(false);

  useEffect(() => {
    if (parsedItems.length > 0 && parsedItems.length !== prevItemCountRef.current) {
      if (!hasPastedRef.current && parsedItems.length > 0) {
        hasPastedRef.current = true;
        buzz(10);
      }
      setItems(toEditable(parsedItems));
    } else if (parsedItems.length === 0 && catalogText.trim() === '') {
      setItems([]);
      hasPastedRef.current = false;
    }
    prevItemCountRef.current = parsedItems.length;
  }, [parsedItems, catalogText]);

  function handleCatalogChange(value: string) {
    setCatalogText(value);
  }

  function addItemFromUnparsed(name: string) {
    setItems((prev) => [...prev, { id: makeItemId(), name, price: 0, available: true }]);
  }

  function updateItemName(id: string, name: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function updateItemPrice(id: string, priceStr: string) {
    const price = parseInt(priceStr.replace(/\D/g, ''), 10);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, price: isNaN(price) ? 0 : price } : it))
    );
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const finalSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      const payload = {
        name: shopName.trim(),
        category,
        city: city.trim() || 'Nigeria',
        whatsapp: whatsappResult.digits,
        hours: hours.trim() || 'Daily',
        brand_color: brandColor,
        tagline: tagline.trim(),
        items: items
          .filter((it) => it.name.trim() && it.price > 0)
          .map((it) => ({
            name: it.name.trim(),
            price: it.price,
            available: it.available,
          })),
      };

      const { data, error: rpcError } = await supabase.rpc('create_shop', { payload });

      if (rpcError) throw rpcError;
      if (!data || data.length === 0) throw new Error('No result returned');

      const result = data[0];
      saveShop(result.slug, result.edit_token);
      navigate(`/manage/${result.slug}?token=${result.edit_token}&new=1&t=${finalSeconds}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(friendlyError(msg));
      setSubmitting(false);
    }
  }

  const displayError = error;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-ink/5 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-semibold text-ink/60 transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold">SharpSharp</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <StopwatchPill seconds={elapsed} />

        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Make your shop
        </h1>
        <p className="mt-1.5 text-ink/60">
          Fill in a few details, paste your catalog, and you're live in under a minute.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          {/* Shop name */}
          <Field label="Shop name" required className="mt-2">
            <input
              id="shop-name"
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Mama Ngozi Kitchen"
              autoComplete="organization"
              className={inputClass}
            />
          </Field>

          {/* Category */}
          <Field label="What do you sell?" required className="mt-6">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`tap-target rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] ${
                    category === c.value
                      ? 'bg-primary text-white shadow-soft'
                      : 'border-2 border-ink/10 bg-white text-ink hover:border-primary/40'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>

          {/* City */}
          <Field label="City" className="mt-6">
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enugu"
              autoComplete="address-level2"
              className={inputClass}
            />
          </Field>

          {/* WhatsApp */}
          <Field label="WhatsApp number" required className="mt-6">
            <input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="0803 123 4567"
              autoComplete="tel"
              className={inputClass}
            />
            {whatsapp.length > 0 && (
              <p
                className={`mt-2 flex items-center gap-1.5 text-sm ${
                  whatsappValid ? 'text-wa-dark' : 'text-red-500'
                }`}
              >
                {whatsappValid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {whatsappValid
                  ? `Orders will go to ${whatsappResult.display}`
                  : 'Enter a valid number, e.g. 0803 123 4567 or +234 803 123 4567'}
              </p>
            )}
          </Field>

          {/* Hours */}
          <Field label="Opening hours" className="mt-6">
            <input
              id="hours"
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Mon–Sat, 8am–7pm"
              className={inputClass}
            />
          </Field>

          {/* Brand color */}
          <Field label="Brand color" className="mt-6">
            <div className="flex flex-wrap gap-3">
              {BRAND_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setBrandColor(c.hex)}
                  aria-label={c.name}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-[0.95] ${
                    brandColor === c.hex
                      ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream'
                      : 'ring-1 ring-ink/10'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {brandColor === c.hex && <CheckCircle2 className="h-5 w-5 text-white" />}
                </button>
              ))}
            </div>
          </Field>

          {/* Catalog paste */}
          <Field label="Paste your catalog" className="mt-8">
            <textarea
              id="catalog"
              value={catalogText}
              onChange={(e) => handleCatalogChange(e.target.value)}
              placeholder={`🍛 Jollof rice pack – ₦2,500\nFried rice + chicken: 3500\nSmall chops (20pcs) 4k\nZobo 1L - N1,200`}
              rows={7}
              className={`${inputClass} resize-none font-body leading-relaxed`}
            />
            <p className="mt-2 text-xs text-ink/50">
              Copy your WhatsApp broadcast and paste it here. We'll detect the items and prices
              automatically.
            </p>
          </Field>

          {/* Animated item list */}
          {(catalogText.trim() || items.length > 0) && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {items.length > 0 ? (
                    <>We found <RollingCount target={items.length} /> {items.length === 1 ? 'item' : 'items'}</>
                  ) : (
                    'No items yet'
                  )}
                </p>
              </div>

              {items.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {items.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      custom={idx}
                      variants={itemDropVariants}
                      initial="hidden"
                      animate="visible"
                      className="rounded-2xl bg-white p-3 shadow-soft"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItemName(item.id, e.target.value)}
                            placeholder="Item name"
                            className="min-w-0 flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm font-medium text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none"
                          />
                          <div className="flex items-center gap-0.5 rounded-lg border border-ink/10 px-2 py-1.5">
                            <span className="text-sm font-semibold text-ink/50">₦</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.price > 0 ? item.price.toLocaleString('en-NG') : ''}
                              onChange={(e) => updateItemPrice(item.id, e.target.value)}
                              placeholder="0"
                              className="w-16 border-0 bg-transparent text-sm font-semibold tabular-nums text-ink placeholder:text-ink/30 focus:outline-none"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteItem(item.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink/30 transition hover:bg-red-50 hover:text-red-500"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Unparsed lines */}
              {unparsed.length > 0 && (
                <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">
                    We couldn't read these, add them manually
                  </p>
                  <div className="mt-2 space-y-2">
                    {unparsed.map((line, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-ink/70">
                          {line}
                        </span>
                        <button
                          type="button"
                          onClick={() => addItemFromUnparsed(line)}
                          className="tap-target shrink-0 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white transition hover:bg-amber-600 active:scale-[0.97]"
                        >
                          <Plus className="h-3.5 w-3.5 inline mr-1" />
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { id: makeItemId(), name: '', price: 0, available: true }])}
                className="mt-3 flex tap-target w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 text-sm font-semibold text-ink/60 transition hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Add item manually
              </button>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="tap-target mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Create my shop
                <ArrowRight className="h-5 w-5" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
