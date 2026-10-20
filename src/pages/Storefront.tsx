import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Minus, ArrowRight, X, MapPin, User, Clock, AlertCircle, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type PanInfo } from 'motion/react';
import {
  supabase,
  naira,
  whatsappLink,
  type Shop,
  type Item,
} from '@/lib/supabase';
import { usePageMeta } from '@/lib/usePageMeta';
import ChatBubble from '@/components/ChatBubble';
import { spring, prefersReducedMotion } from '@/lib/motion';
import { buzz } from '@/lib/buzz';

/* ---------- Demo shop slugs ---------- */
const DEMO_SLUGS = new Set(['mama-ngozi-kitchen', 'chioma-stitches', 'gadget-plug-ng']);

/* ---------- Category emoji map ---------- */
const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍲',
  'Food vendor': '🍲',
  'Fashion & Tailoring': '🧵',
  Fashion: '🧵',
  'Hair & Beauty': '💇🏾‍♀️',
  'Hair & beauty': '💇🏾‍♀️',
  'Phones & Gadgets': '📱',
  Phones: '📱',
  Bakery: '🎂',
  Thrift: '👗',
  Other: '🛍️',
};

function emojiFor(category: string): string {
  return CATEGORY_EMOJI[category] ?? '🛍️';
}

/* ---------- Hours parsing ---------- */
function parseOpenNow(hours: string): { open: boolean; label: string } | null {
  const match = hours.match(/(\d{1,2})\s*(?:am|pm)?\s*[–\-]\s*(\d{1,2})\s*(am|pm)/i);
  if (!match) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const toMinutes = (h: number, period: string): number => {
    let hour = h;
    const p = period.toLowerCase();
    if (p === 'pm' && hour !== 12) hour += 12;
    if (p === 'am' && hour === 12) hour = 0;
    return hour * 60;
  };

  let startH = parseInt(match[1], 10);
  let endH = parseInt(match[2], 10);
  const endPeriod = match[3];

  const endM = toMinutes(endH, endPeriod);
  const startPeriod = endPeriod.toLowerCase() === 'pm' && startH < endH ? 'am' : endPeriod;
  const startM = toMinutes(startH, startPeriod);

  const open = currentMinutes >= startM && currentMinutes <= endM;
  return { open, label: open ? 'Open now' : 'Closed' };
}

/* ---------- Cart type ---------- */
type CartEntry = { itemId: string; name: string; price: number; qty: number };

/* ---------- Session storage helpers ---------- */
const cartKey = (slug: string) => `sharpsharp:cart:${slug}`;
const viewKey = (slug: string) => `sharpsharp:viewed:${slug}`;

function loadCart(slug: string): CartEntry[] {
  try {
    const raw = sessionStorage.getItem(cartKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function saveCart(slug: string, cart: CartEntry[]): void {
  try {
    sessionStorage.setItem(cartKey(slug), JSON.stringify(cart));
  } catch {
    // ignore
  }
}

function hasViewed(slug: string): boolean {
  try {
    return sessionStorage.getItem(viewKey(slug)) === '1';
  } catch {
    return false;
  }
}

function markViewed(slug: string): void {
  try {
    sessionStorage.setItem(viewKey(slug), '1');
  } catch {
    // ignore
  }
}

/* ---------- Rolling digit counter ---------- */
function RollingNaira({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.4,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, mv]);

  return <span className="tabular-nums">{naira(display)}</span>;
}

/* ---------- Main component ---------- */
export default function Storefront() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [delivery, setDelivery] = useState('');
  const viewInserted = useRef(false);
  const [headerStuck, setHeaderStuck] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const cartEverShownRef = useRef(false);
  const prevTotalRef = useRef(0);

  usePageMeta(
    shop ? `${shop.name} — SharpSharp` : 'Shop — SharpSharp',
    shop
      ? `Order from ${shop.name} in ${shop.city}. Browse items and send your order on WhatsApp.`
      : 'Browse and order from this shop on WhatsApp.'
  );

  // Load shop + items
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      setLoadError(null);

      try {
        const { data: shopData, error: shopErr } = await supabase
          .from('public_shops')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (cancelled) return;

        if (shopErr) throw shopErr;

        if (!shopData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setShop(shopData as Shop);

        const { data: itemData, error: itemErr } = await supabase
          .from('items')
          .select('*')
          .eq('shop_id', shopData.id)
          .eq('available', true)
          .order('position', { ascending: true });

        if (cancelled) return;

        if (itemErr) throw itemErr;

        if (itemData) {
          setItems(itemData as Item[]);
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoadError('Could not load this shop. Please check your connection and try again.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Load cart from sessionStorage
  useEffect(() => {
    if (!slug) return;
    setCart(loadCart(slug));
  }, [slug]);

  // Insert view event once per session
  useEffect(() => {
    if (!slug || !shop || viewInserted.current) return;
    if (hasViewed(slug)) {
      viewInserted.current = true;
      return;
    }
    viewInserted.current = true;
    markViewed(slug);

    supabase
      .from('events')
      .insert({ shop_id: shop.id, type: 'view' })
      .then(() => {
        // fire and forget — analytics only
      });
  }, [slug, shop]);

  // Persist cart
  useEffect(() => {
    if (!slug) return;
    saveCart(slug, cart);
  }, [slug, cart]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  // Scroll detection for header condense
  useEffect(() => {
    if (!shop) return;
    const onScroll = () => {
      setHeaderStuck(window.scrollY > 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shop]);

  const cartCount = useMemo(() => cart.reduce((s, e) => s + e.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, e) => s + e.qty * e.price, 0), [cart]);

  // Pulse cart bar when total changes (after first appearance)
  useEffect(() => {
    if (cart.length > 0 && prevTotalRef.current !== cartTotal) {
      if (cartEverShownRef.current) {
        setCartPulse(true);
        const t = setTimeout(() => setCartPulse(false), 600);
        return () => clearTimeout(t);
      }
      prevTotalRef.current = cartTotal;
    }
    prevTotalRef.current = cartTotal;
  }, [cartTotal, cart.length]);

  const addToCart = useCallback((item: Item) => {
    buzz(8);
    setCart((prev) => {
      const existing = prev.find((e) => e.itemId === item.id);
      if (existing) {
        return prev.map((e) => (e.itemId === item.id ? { ...e, qty: e.qty + 1 } : e));
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.itemId === itemId);
      if (!existing) return prev;
      if (existing.qty <= 1) {
        return prev.filter((e) => e.itemId !== itemId);
      }
      return prev.map((e) => (e.itemId === itemId ? { ...e, qty: e.qty - 1 } : e));
    });
  }, []);

  const setQty = useCallback((itemId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((e) => e.itemId !== itemId);
      return prev.map((e) => (e.itemId === itemId ? { ...e, qty } : e));
    });
  }, []);

  const getQty = (itemId: string): number => {
    return cart.find((e) => e.itemId === itemId)?.qty ?? 0;
  };

  const openStatus = shop ? parseOpenNow(shop.hours) : null;

  // Build WhatsApp message
  const buildMessage = useCallback((): string => {
    if (!shop) return '';
    const lines: string[] = [`Hello ${shop.name}! 👋 I'd like to order:`];
    for (const entry of cart) {
      lines.push(`• ${entry.qty} × ${entry.name} (${naira(entry.qty * entry.price)})`);
    }
    lines.push(`Total: ${naira(cartTotal)}`);
    if (customerName.trim()) {
      lines.push(`Name: ${customerName.trim()}`);
    }
    if (delivery.trim()) {
      lines.push(`Delivery: ${delivery.trim()}`);
    }
    lines.push('(Sent from my SharpSharp link)');
    return lines.join('\n');
  }, [shop, cart, cartTotal, customerName, delivery]);

  const sendOrder = () => {
    if (!shop) return;

    supabase
      .from('events')
      .insert({ shop_id: shop.id, type: 'order_click' })
      .then(() => {
        // fire and forget
      });

    const url = whatsappLink(shop.whatsapp, buildMessage());
    window.open(url, '_blank', 'noopener,noreferrer');

    setOrderSent(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setTimeout(() => setOrderSent(false), 300);
  };

  /* ---------- Render: loading skeleton ---------- */
  if (loading) {
    return <StorefrontSkeleton />;
  }

  /* ---------- Render: error ---------- */
  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-3 text-ink/60">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="tap-target mt-8 inline-flex items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Render: not found ---------- */
  if (notFound || !shop) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-3xl">
            🤔
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
            This shop doesn't exist yet
          </h1>
          <p className="mt-3 text-ink/60">
            Maybe the link is wrong, or the shop was never created. Either way, you can make
            your own in under a minute.
          </p>
          <Link
            to="/create"
            className="tap-target mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98]"
          >
            Make one in 60 seconds
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  const initial = shop.name.charAt(0).toUpperCase();
  const emoji = emojiFor(shop.category);
  const isDemo = DEMO_SLUGS.has(shop.slug);
  const reduced = prefersReducedMotion();

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* Full header band — condenses on scroll (transform only) */}
      <div
        className="sticky top-0 z-10 px-5 pb-6 pt-8 text-white"
        style={{ backgroundColor: shop.brand_color }}
      >
        <div className="relative mx-auto max-w-xl">
          {/* Full header (always rendered — provides stable height) */}
          <motion.div
            animate={{
              opacity: headerStuck ? 0 : 1,
              transform: headerStuck ? 'scale(0.92)' : 'scale(1)',
            }}
            transition={reduced ? { duration: 0 } : spring}
            style={{ transformOrigin: 'top left' }}
          >
            {/* Demo ribbon */}
            {isDemo && (
              <span className="absolute right-0 -top-1 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink shadow-sm">
                Demo shop
              </span>
            )}
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold backdrop-blur"
                aria-hidden="true"
              >
                {initial}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h1 className="font-display text-2xl font-bold leading-tight">{shop.name}</h1>
                <p className="mt-0.5 text-sm text-white/80">
                  {shop.category} · {shop.city}
                </p>
                {shop.tagline && (
                  <p className="mt-1 text-sm text-white/90">{shop.tagline}</p>
                )}
              </div>
            </div>

            {/* Hours / open status */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
              <span className="text-sm text-white/90">{shop.hours}</span>
              {openStatus && (
                <span
                  className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
                    openStatus.open
                      ? 'bg-white text-green-700'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {openStatus.label}
                </span>
              )}
            </div>
          </motion.div>

          {/* Compact bar (overlaid, transform only) */}
          <motion.div
            className="absolute inset-x-0 top-0 flex items-center gap-2"
            animate={{
              opacity: headerStuck ? 1 : 0,
              transform: headerStuck ? 'translateY(0)' : 'translateY(-8px)',
            }}
            transition={reduced ? { duration: 0 } : spring}
            style={{ pointerEvents: headerStuck ? 'auto' : 'none' }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold"
              aria-hidden="true"
            >
              {initial}
            </div>
            <span className="truncate font-display text-base font-bold">{shop.name}</span>
            {openStatus && (
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  openStatus.open
                    ? 'bg-white text-green-700'
                    : 'bg-white/20 text-white'
                }`}
              >
                {openStatus.label}
              </span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Items */}
      <div className="mx-auto max-w-xl px-5 pt-6">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Menu</h2>
        <div className="space-y-3">
          {items.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-ink/50">
              No items available right now. Check back soon!
            </p>
          )}
          {items.map((item) => {
            const qty = getQty(item.id);
            return (
              <ItemCard
                key={item.id}
                item={item}
                emoji={emoji}
                qty={qty}
                brandColor={shop.brand_color}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-ink/5 pt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Make your own shop link in 60 seconds with SharpSharp
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <p className="mt-2 text-xs text-ink/40">
            Built on{' '}
            <a
              href="https://bolt.new"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink/60 hover:underline"
            >
              Bolt
            </a>
          </p>
        </footer>
      </div>

      {/* Sticky cart bar with spring entrance + pulse on change */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-20"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={reduced ? { duration: 0 } : spring}
            onAnimationComplete={() => {
              cartEverShownRef.current = true;
            }}
          >
            <div className="mx-auto max-w-xl px-4 pb-4">
              <motion.div
                className="flex items-center gap-3 rounded-2xl bg-ink p-3 shadow-lift"
                animate={
                  cartPulse && !reduced
                    ? { scale: [1, 1.03, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.3 }}
              >
                <div className="flex-1 pl-1" aria-live="polite" aria-atomic="true">
                  <p className="text-sm font-semibold text-cream">
                    {cartCount} {cartCount === 1 ? 'item' : 'items'} ·{' '}
                    <RollingNaira value={cartTotal} />
                  </p>
                </div>
                <button
                  onClick={() => setSheetOpen(true)}
                  className="flex tap-target items-center justify-center gap-2 rounded-xl bg-wa px-5 text-sm font-bold text-white transition hover:bg-wa-dark active:scale-[0.98]"
                >
                  <ChatBubble className="h-4 w-4" />
                  Order on WhatsApp
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout bottom sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <CheckoutSheet
            cart={cart}
            total={cartTotal}
            shopName={shop.name}
            shopUrl={`${window.location.origin}/s/${shop.slug}`}
            customerName={customerName}
            delivery={delivery}
            orderSent={orderSent}
            messagePreview={buildMessage()}
            onNameChange={setCustomerName}
            onDeliveryChange={setDelivery}
            onQtyChange={setQty}
            onClose={closeSheet}
            onSend={sendOrder}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Loading skeleton ---------- */

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="px-5 pb-6 pt-8">
        <div className="mx-auto max-w-xl">
          <div className="flex items-start gap-4">
            <div className="skeleton h-16 w-16 !rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="skeleton h-6 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
          <div className="skeleton mt-4 h-8 w-2/3" />
        </div>
      </div>
      <div className="mx-auto max-w-xl space-y-3 px-5 pt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
            <div className="skeleton h-14 w-14 !rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/3" />
            </div>
            <div className="skeleton h-10 w-16 !rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Item card with morphing Add → qty control ---------- */

function ItemCard({
  item,
  emoji,
  qty,
  brandColor,
  onAdd,
  onRemove,
}: {
  item: Item;
  emoji: string;
  qty: number;
  brandColor: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const reduced = prefersReducedMotion();

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
      {/* Emoji tile */}
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ backgroundColor: brandColor + '15' }}
        aria-hidden="true"
      >
        {emoji}
      </div>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{item.name}</p>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink/50">
            {item.description}
          </p>
        )}
        <p className="mt-1 font-bold text-primary tabular-nums">{naira(item.price)}</p>
      </div>

      {/* Quantity control — morphs from Add button to −/qty/+ */}
      <div className="shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {qty === 0 ? (
            <motion.button
              key="add"
              onClick={onAdd}
              className="tap-target rounded-xl bg-ink px-4 text-sm font-bold text-cream transition hover:bg-ink/90 active:scale-[0.97]"
              aria-label={`Add ${item.name} to cart`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={reduced ? { duration: 0 } : spring}
            >
              Add
            </motion.button>
          ) : (
            <motion.div
              key="qty"
              className="flex items-center gap-1.5 rounded-xl border-2 border-ink/10 bg-white p-0.5"
              role="group"
              aria-label={`Quantity for ${item.name}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={reduced ? { duration: 0 } : spring}
            >
              <button
                onClick={onRemove}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-ink/5 active:scale-[0.95]"
                aria-label={`Remove one ${item.name}`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <motion.span
                key={qty}
                className="w-5 text-center text-sm font-bold tabular-nums text-ink"
                aria-live="polite"
                initial={reduced ? false : { scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {qty}
              </motion.span>
              <button
                onClick={onAdd}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-ink/5 active:scale-[0.95]"
                aria-label={`Add one ${item.name}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- WhatsApp message preview bubble ---------- */

function MessagePreview({ message, shopName }: { message: string; shopName: string }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-xs font-semibold text-ink/60">
        This is what {shopName} will see.
      </p>
      <div className="rounded-2xl bg-[#E5DDD5] p-3">
        <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#DCF8C6] p-3 shadow-sm">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{message}</p>
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] text-ink/40 tabular-nums">{timeStr}</span>
            <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Success state inside sheet ---------- */

function OrderSentState({ shopName, shopUrl }: { shopName: string; shopUrl: string }) {
  const reduced = prefersReducedMotion();

  return (
    <div className="flex flex-col items-center px-5 pb-8 pt-6 text-center">
      <motion.div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-wa/15"
        initial={reduced ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 18 }}
      >
        <motion.div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-wa"
          initial={reduced ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
        >
          <Check className="h-7 w-7 text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">Order sent to WhatsApp</h2>
      <p className="mt-2 text-sm text-ink/60">
        {shopName} will reply you there.
      </p>
      <Link
        to="/"
        className="tap-target mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98]"
      >
        Make your own shop like this
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/* ---------- Checkout bottom sheet (draggable) ---------- */

function CheckoutSheet({
  cart,
  total,
  shopName,
  shopUrl,
  customerName,
  delivery,
  orderSent,
  messagePreview,
  onNameChange,
  onDeliveryChange,
  onQtyChange,
  onClose,
  onSend,
}: {
  cart: CartEntry[];
  total: number;
  shopName: string;
  shopUrl: string;
  customerName: string;
  delivery: string;
  orderSent: boolean;
  messagePreview: string;
  onNameChange: (v: string) => void;
  onDeliveryChange: (v: string) => void;
  onQtyChange: (itemId: string, qty: number) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const reduced = prefersReducedMotion();
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(dragY, [0, 300], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Order checkout">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ opacity: backdropOpacity }}
      />

      {/* Draggable sheet */}
      <motion.div
        className="relative max-h-[85vh] overflow-y-auto rounded-t-3xl bg-cream"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={reduced ? { duration: 0 } : spring}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        style={{ y: dragY }}
        onDragEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-cream pt-3">
          <div className="mx-auto h-1.5 w-10 cursor-grab rounded-full bg-ink/15 active:cursor-grabbing" aria-hidden="true" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-ink/40 transition hover:bg-ink/5 hover:text-ink"
            aria-label="Close checkout"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {orderSent ? (
          <OrderSentState shopName={shopName} shopUrl={shopUrl} />
        ) : (
          <div className="px-5 pb-6 pt-2">
            <h2 className="font-display text-xl font-bold text-ink">Your order</h2>
            <p className="mt-0.5 text-sm text-ink/50">Review and send to {shopName} on WhatsApp.</p>

            {/* Order summary */}
            <div className="mt-4 space-y-2.5">
              {cart.map((entry) => (
                <div
                  key={entry.itemId}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{entry.name}</p>
                    <p className="text-xs text-ink/50 tabular-nums">{naira(entry.price)} each</p>
                  </div>
                  <div
                    className="flex items-center gap-1.5 rounded-xl border-2 border-ink/10 bg-white p-0.5"
                    role="group"
                    aria-label={`Quantity for ${entry.name}`}
                  >
                    <button
                      onClick={() => onQtyChange(entry.itemId, entry.qty - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink transition hover:bg-ink/5 active:scale-[0.95]"
                      aria-label={`Remove one ${entry.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums text-ink" aria-live="polite">
                      {entry.qty}
                    </span>
                    <button
                      onClick={() => onQtyChange(entry.itemId, entry.qty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink transition hover:bg-ink/5 active:scale-[0.95]"
                      aria-label={`Add one ${entry.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-primary">
                    {naira(entry.qty * entry.price)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink p-4">
              <span className="text-sm font-semibold text-cream/80">Total</span>
              <span className="font-display text-xl font-bold text-cream tabular-nums" aria-live="polite">
                {naira(total)}
              </span>
            </div>

            {/* Optional fields */}
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="customer-name" className="mb-1.5 block text-xs font-semibold text-ink/60">
                  Your name (optional)
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" aria-hidden="true" />
                  <input
                    id="customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="e.g. Chidi"
                    autoComplete="name"
                    className="tap-target w-full rounded-2xl border-2 border-ink/10 bg-white pl-10 pr-4 text-base text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="delivery-info" className="mb-1.5 block text-xs font-semibold text-ink/60">
                  Delivery address or pickup? (optional)
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" aria-hidden="true" />
                  <input
                    id="delivery-info"
                    type="text"
                    value={delivery}
                    onChange={(e) => onDeliveryChange(e.target.value)}
                    placeholder="e.g. 12 Allen Ave, Ikeja or Pickup"
                    autoComplete="street-address"
                    className="tap-target w-full rounded-2xl border-2 border-ink/10 bg-white pl-10 pr-4 text-base text-ink placeholder:text-ink/30 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* WhatsApp message preview */}
            <MessagePreview message={messagePreview} shopName={shopName} />

            {/* Send button */}
            <button
              onClick={onSend}
              className="tap-target mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-wa px-6 text-base font-bold text-white shadow-soft transition hover:bg-wa-dark active:scale-[0.98]"
            >
              <ChatBubble className="h-5 w-5" />
              Send order on WhatsApp
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
