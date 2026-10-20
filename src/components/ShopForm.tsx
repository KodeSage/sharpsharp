import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { parseCatalog, type ParsedItem } from '@/lib/parseCatalog';
import { normalizeWhatsapp } from '@/lib/shop';

export type EditableItem = {
  id: string;
  name: string;
  price: number;
  available: boolean;
};

export type ShopFormValues = {
  name: string;
  category: string;
  city: string;
  whatsapp: string;
  hours: string;
  brandColor: string;
  tagline: string;
  items: EditableItem[];
};

export type ShopFormPrefill = {
  name: string;
  category: string;
  city: string;
  whatsapp: string;
  hours: string;
  brandColor: string;
  tagline: string;
  items: { id: string; name: string; price: number; available: boolean }[];
};

export const CATEGORIES = [
  { label: 'Food', value: 'Food' },
  { label: 'Fashion & Tailoring', value: 'Fashion & Tailoring' },
  { label: 'Hair & Beauty', value: 'Hair & Beauty' },
  { label: 'Phones & Gadgets', value: 'Phones & Gadgets' },
  { label: 'Bakery', value: 'Bakery' },
  { label: 'Thrift', value: 'Thrift' },
  { label: 'Other', value: 'Other' },
];

export const BRAND_COLORS = [
  { name: 'Orange', hex: '#FF5A1F' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Teal', hex: '#0D9488' },
];

const CATALOG_PLACEHOLDER = `🍛 Jollof rice pack – ₦2,500
Fried rice + chicken: 3500
Small chops (20pcs) 4k
Zobo 1L - N1,200`;

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

/**
 * Shared shop form used by both /create and the edit section of /manage.
 *
 * - Without `prefill`: starts empty (create mode), shows the catalog paste textarea.
 * - With `prefill`: starts prefilled (edit mode), still allows catalog paste.
 *
 * The parent controls the submit button label via `submitLabel` and receives
 * the form values via `onValuesChange` (for validation) and `onSubmit` (on submit).
 */
export default function ShopForm({
  prefill,
  submitLabel,
  submitting,
  onSubmit,
  submitError,
  submitDisabled,
  showCatalogPaste = true,
}: {
  prefill?: ShopFormPrefill;
  submitLabel: React.ReactNode;
  submitting: boolean;
  onSubmit: (values: ShopFormValues) => void;
  submitError?: string | null;
  submitDisabled?: boolean;
  showCatalogPaste?: boolean;
}) {
  const [shopName, setShopName] = useState(prefill?.name ?? '');
  const [category, setCategory] = useState(prefill?.category ?? '');
  const [city, setCity] = useState(prefill?.city ?? '');
  const [whatsapp, setWhatsapp] = useState(prefill?.whatsapp ?? '');
  const [hours, setHours] = useState(prefill?.hours ?? '');
  const [brandColor, setBrandColor] = useState(prefill?.brandColor ?? '#FF5A1F');
  const [tagline, setTagline] = useState(prefill?.tagline ?? '');
  const [catalogText, setCatalogText] = useState('');
  const [items, setItems] = useState<EditableItem[]>(prefill?.items ?? []);
  const [itemsEdited, setItemsEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whatsappResult = useMemo(() => normalizeWhatsapp(whatsapp), [whatsapp]);
  const parsedPreview = useMemo(() => parseCatalog(catalogText), [catalogText]);

  const nameValid = shopName.trim().length >= 2;
  const whatsappValid = whatsappResult.valid;
  const canSubmit =
    nameValid && whatsappValid && category !== '' && !submitting && !submitDisabled;

  // Expose current values to parent via a ref-like callback
  const values: ShopFormValues = {
    name: shopName.trim(),
    category,
    city: city.trim() || 'Nigeria',
    whatsapp: whatsappResult.digits,
    hours: hours.trim() || 'Daily',
    brandColor,
    tagline: tagline.trim(),
    items,
  };

  function handleCatalogChange(value: string) {
    setCatalogText(value);
    if (!itemsEdited) {
      setItems(toEditable(parseCatalog(value)));
    }
  }

  function useParsedItems() {
    setItems(toEditable(parsedPreview));
    setItemsEdited(false);
  }

  function updateItemName(id: string, name: string) {
    setItemsEdited(true);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function updateItemPrice(id: string, priceStr: string) {
    setItemsEdited(true);
    const price = parseInt(priceStr.replace(/\D/g, ''), 10);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, price: isNaN(price) ? 0 : price } : it))
    );
  }

  function toggleAvailable(id: string) {
    setItemsEdited(true);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, available: !it.available } : it)));
  }

  function deleteItem(id: string) {
    setItemsEdited(true);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function moveItem(id: string, dir: -1 | 1) {
    setItemsEdited(true);
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  function addItem() {
    setItemsEdited(true);
    setItems((prev) => [...prev, { id: makeItemId(), name: '', price: 0, available: true }]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    onSubmit(values);
  }

  const displayError = submitError ?? error;

  return (
    <form onSubmit={handleSubmit}>
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

      {/* Catalog paste (optional in edit mode) */}
      {showCatalogPaste && (
        <Field label="Paste your catalog" className="mt-8">
          <textarea
            id="catalog"
            value={catalogText}
            onChange={(e) => handleCatalogChange(e.target.value)}
            placeholder={CATALOG_PLACEHOLDER}
            rows={7}
            className={`${inputClass} resize-none font-body leading-relaxed`}
          />
          <p className="mt-2 text-xs text-ink/50">
            Copy your WhatsApp broadcast and paste it here. We'll detect the items and prices
            automatically.
          </p>
        </Field>
      )}

      {/* Live item list */}
      {(catalogText.trim() || items.length > 0) && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-primary" />
              {items.length > 0
                ? `${items.length} ${items.length === 1 ? 'item' : 'items'}`
                : 'No items yet'}
            </p>
            {itemsEdited && parsedPreview.length > 0 && (
              <button
                type="button"
                onClick={useParsedItems}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Re-sync from paste
              </button>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {items.map((item, idx) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={idx}
                  total={items.length}
                  onNameChange={(v) => updateItemName(item.id, v)}
                  onPriceChange={(v) => updateItemPrice(item.id, v)}
                  onToggleAvailable={() => toggleAvailable(item.id)}
                  onDelete={() => deleteItem(item.id)}
                  onMoveUp={() => moveItem(item.id, -1)}
                  onMoveDown={() => moveItem(item.id, 1)}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addItem}
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

      {/* Submit button (inline, not sticky — parent controls layout) */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="tap-target mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}

/* ---------- Shared UI pieces ---------- */

export const inputClass =
  'tap-target w-full rounded-2xl border-2 border-ink/10 bg-white px-4 text-base text-ink placeholder:text-ink/30 transition focus:border-primary focus:outline-none focus:ring-0';

let fieldIdCounter = 0;
function useFieldId(): string {
  const [id] = useState(() => `field-${++fieldIdCounter}`);
  return id;
}

export function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useFieldId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      {children}
    </div>
  );
}

function ItemCard({
  item,
  index,
  total,
  onNameChange,
  onPriceChange,
  onToggleAvailable,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: EditableItem;
  index: number;
  total: number;
  onNameChange: (v: string) => void;
  onPriceChange: (v: string) => void;
  onToggleAvailable: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-3 shadow-soft ${
        !item.available ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Reorder */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-ink/40 transition hover:bg-ink/5 hover:text-ink disabled:opacity-20 disabled:hover:bg-transparent"
            aria-label="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-ink/40 transition hover:bg-ink/5 hover:text-ink disabled:opacity-20 disabled:hover:bg-transparent"
            aria-label="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Name + price */}
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Item name"
            className="min-w-0 flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm font-medium text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none"
          />
          <div className="flex items-center gap-0.5 rounded-lg border border-ink/10 px-2 py-1.5">
            <span className="text-sm font-semibold text-ink/50">₦</span>
            <input
              type="text"
              inputMode="numeric"
              value={item.price > 0 ? item.price.toLocaleString('en-NG') : ''}
              onChange={(e) => onPriceChange(e.target.value)}
              placeholder="0"
              className="w-16 border-0 bg-transparent text-sm font-semibold text-ink placeholder:text-ink/30 focus:outline-none"
            />
          </div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink/30 transition hover:bg-red-50 hover:text-red-500"
          aria-label="Delete item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Availability toggle */}
      <button
        type="button"
        onClick={onToggleAvailable}
        className="mt-2 flex items-center gap-1.5 pl-1 text-xs font-semibold text-ink/50 transition hover:text-ink"
      >
        {item.available ? (
          <>
            <Eye className="h-3.5 w-3.5 text-wa-dark" />
            Visible to customers
          </>
        ) : (
          <>
            <EyeOff className="h-3.5 w-3.5" />
            Hidden from customers
          </>
        )}
      </button>
    </div>
  );
}

export function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('missing required')) {
    return 'Please fill in your shop name, WhatsApp number, and category.';
  }
  if (m.includes('unique') || m.includes('slug')) {
    return 'That shop name is taken — try adding a small word to make it unique.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return "We couldn't reach the server. Check your internet and try again.";
  }
  return 'Something went wrong. Please try again.';
}
