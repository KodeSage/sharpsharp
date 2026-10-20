import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Share2,
  Eye,
  MousePointerClick,
  TrendingUp,
  Printer,
  Download,
  Bookmark,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  supabase,
  type Shop,
  type Item,
  type ShopStats,
} from '@/lib/supabase';
import ShopForm, {
  type ShopFormValues,
  type ShopFormPrefill,
  friendlyError,
} from '@/components/ShopForm';
import ChatBubble from '@/components/ChatBubble';
import { printPoster, type PosterStyle } from '@/lib/qr';
import { usePageMeta } from '@/lib/usePageMeta';
import { buzz } from '@/lib/buzz';

/* ---------- Tea cup SVG with steam ---------- */
function TeaCup({ steamOpacity }: { steamOpacity: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g opacity={steamOpacity} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M8 2c0 1-1 1.5-1 2.5S8 5.5 8 6.5" />
        <path d="M12 1c0 1-1 1.5-1 2.5S12 4.5 12 5.5" />
        <path d="M16 2c0 1-1 1.5-1 2.5S16 5.5 16 6.5" />
      </g>
      <path d="M4 9h13v5a4 4 0 01-4 4H8a4 4 0 01-4-4V9z" fill="currentColor" opacity="0.9" />
      <path d="M17 10h2a2 2 0 010 4h-2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="3" y="19" width="15" height="2" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/* ---------- Brand-colored confetti ---------- */
function Confetti({ brandColor }: { brandColor: string }) {
  const pieces = useMemo(() => {
    const colors = [brandColor, brandColor, '#25D366', '#FFD700', brandColor];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
    }));
  }, [brandColor]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute h-2.5 w-2.5"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s linear forwards`,
            borderRadius: p.id % 2 === 0 ? '50%' : '2px',
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          to { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Toast ---------- */
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 animate-toast-in">
      <div className="flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-cream shadow-lift" role="status" aria-live="polite">
        <Check className="h-4 w-4 text-wa" aria-hidden="true" />
        {message}
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function Manage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isNew = searchParams.get('new') === '1';
  const createSeconds = searchParams.get('t');

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [showConfetti, setShowConfetti] = useState(isNew);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [posterStyle, setPosterStyle] = useState<PosterStyle>('bold');

  const shopUrl = useMemo(() => {
    if (typeof window === 'undefined' || !slug) return '';
    return `${window.location.origin}/s/${slug}`;
  }, [slug]);

  const manageUrl = useMemo(() => {
    if (typeof window === 'undefined' || !slug || !token) return '';
    return `${window.location.origin}/manage/${slug}?token=${token}`;
  }, [slug, token]);

  usePageMeta(
    shop ? `${shop.name} — Dashboard — SharpSharp` : 'Dashboard — SharpSharp',
    shop ? `Manage your shop: ${shop.name}. View stats, edit items, print QR poster, share your link.` : 'Manage your SharpSharp shop.'
  );

  // Load shop + items + stats
  const loadData = useCallback(async () => {
    if (!slug || !token) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const { data: shopData, error: shopErr } = await supabase
        .from('public_shops')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (shopErr) throw shopErr;

      if (!shopData) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      setShop(shopData as Shop);

      const { data: itemData, error: itemErr } = await supabase
        .from('items')
        .select('*')
        .eq('shop_id', shopData.id)
        .order('position', { ascending: true });

      if (itemErr) throw itemErr;

      if (itemData) setItems(itemData as Item[]);

      // Load stats via RPC
      const { data: statsData, error: statsErr } = await supabase.rpc('get_shop_stats', {
        p_slug: slug,
        p_token: token,
      });

      if (statsErr) throw statsErr;

      if (statsData) {
        const row = Array.isArray(statsData) ? statsData[0] : statsData;
        setStats({
          total_views: Number(row?.total_views ?? 0),
          total_order_clicks: Number(row?.total_order_clicks ?? 0),
          order_clicks_7d: Number(row?.order_clicks_7d ?? 0),
        });
      }

      setLoading(false);
    } catch {
      setLoadError('Could not load your dashboard. Please check your connection and try again.');
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate QR code
  useEffect(() => {
    if (!shopUrl) return;
    QRCode.toDataURL(shopUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [shopUrl]);

  // Hide confetti after 4s + buzz on first visit
  useEffect(() => {
    if (!showConfetti) return;
    buzz([15, 40, 15]);
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, [showConfetti]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(msg: string) {
    setToast(msg);
  }

  async function handleSave(values: ShopFormValues) {
    if (!slug || !token) return;
    setSaving(true);
    setSaveError(null);

    try {
      const payload = {
        name: values.name,
        category: values.category,
        city: values.city,
        whatsapp: values.whatsapp,
        hours: values.hours,
        brand_color: values.brandColor,
        tagline: values.tagline,
        items: values.items
          .filter((it) => it.name.trim() && it.price > 0)
          .map((it) => ({
            name: it.name.trim(),
            price: it.price,
            available: it.available,
          })),
      };

      const { error: rpcError } = await supabase.rpc('update_shop', {
        p_slug: slug,
        p_token: token,
        payload,
      });

      if (rpcError) throw rpcError;

      await loadData();
      setSaving(false);
      setEditOpen(false);
      showToast('Saved ✓');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setSaveError(friendlyError(msg));
      setSaving(false);
    }
  }

  /* ---------- Copy helpers ---------- */
  const [linkCopied, setLinkCopied] = useState(false);
  const [privateCopied, setPrivateCopied] = useState(false);

  async function copyLink(url: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(url);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // fallback
    }
  }

  const cheapestItemPrice = useMemo(() => {
    const prices = items.filter((it) => it.available && it.price > 0).map((it) => it.price);
    return prices.length > 0 ? Math.min(...prices) : undefined;
  }, [items]);

  /* ---------- Render: loading skeleton ---------- */
  if (loading) {
    return <ManageSkeleton />;
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

  /* ---------- Render: auth error ---------- */
  if (authError || !shop || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
            This link isn't valid
          </h1>
          <p className="mt-3 text-ink/60">
            Use the private link you got when you created your shop. It looks like
            <br />
            <code className="mt-1 inline-block rounded bg-ink/5 px-2 py-0.5 text-sm">
              /manage/your-shop?token=...
            </code>
          </p>
          <Link
            to="/"
            className="tap-target mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98]"
          >
            Go home
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  const prefill: ShopFormPrefill = {
    name: shop.name,
    category: shop.category,
    city: shop.city,
    whatsapp: shop.whatsapp,
    hours: shop.hours,
    brandColor: shop.brand_color,
    tagline: shop.tagline ?? '',
    items: items.map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      available: it.available,
    })),
  };

  const shareText = `Order from ${shop.name} here: ${shopUrl}`;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const selfShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Keep this link safe — it's your SharpSharp dashboard: ${manageUrl}`
  )}`;

  return (
    <div className="min-h-screen bg-cream pb-12">
      {showConfetti && shop && <Confetti brandColor={shop.brand_color} />}

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-ink/5 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-semibold text-ink/60 transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white" aria-hidden="true">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold">SharpSharp</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 pt-6">
        {/* Shop name header */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: shop.brand_color }}
            aria-hidden="true"
          >
            {shop.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold leading-tight text-ink">{shop.name}</h1>
            <p className="text-sm text-ink/50">Seller dashboard</p>
          </div>
        </div>

        {/* 1. Success banner with tea timer */}
        {isNew && (
          <div className="mb-6 rounded-3xl bg-wa/10 p-5">
            <div className="flex items-center gap-3">
              <span className="text-wa-dark">
                <TeaCup steamOpacity={createSeconds ? Math.max(0, 1 - Number(createSeconds) / 120) : 1} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold text-wa-dark">
                  Your shop is live in {createSeconds ?? '—'} seconds.
                </p>
                <p className="mt-0.5 text-sm text-ink/70">
                  {createSeconds && Number(createSeconds) > 120
                    ? "Tea's a bit cold, but your shop is hot 🔥"
                    : "Tea's still hot ☕"}
                </p>
              </div>
            </div>
            {createSeconds && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `I just put my business online in ${createSeconds} seconds with SharpSharp ☕⚡ Order from me here: ${shopUrl}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="tap-target mt-4 flex items-center justify-center gap-2 rounded-2xl bg-wa px-5 text-sm font-bold text-white transition hover:bg-wa-dark active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share my time
              </a>
            )}
          </div>
        )}

        {/* 2. Your shop link */}
        <Card className="mb-4">
          <h2 className="card-title">Your shop link</h2>
          <p className="card-desc">Share this with your customers so they can browse and order.</p>

          <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{shopUrl}</span>
            <Link
              to={`/s/${shop.slug}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/40 transition hover:bg-ink/5 hover:text-ink"
              aria-label="Open shop in new view"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => copyLink(shopUrl, setLinkCopied)}
              className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-cream transition hover:bg-ink/90 active:scale-[0.98]"
            >
              {linkCopied ? (
                <>
                  <Check className="h-4 w-4 text-wa" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy link
                </>
              )}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl bg-wa px-4 text-sm font-bold text-white transition hover:bg-wa-dark active:scale-[0.98]"
            >
              <ChatBubble className="h-4 w-4" aria-hidden="true" />
              Share on WhatsApp
            </a>
          </div>

          <p className="mt-3 text-xs text-ink/50">
            Post this link on your WhatsApp Status so customers can order anytime.
          </p>
        </Card>

        {/* 3. Stats */}
        <Card className="mb-4">
          <h2 className="card-title">Stats</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatBox
              icon={Eye}
              value={stats?.total_views ?? 0}
              label="Shop views"
              color="#2563EB"
            />
            <StatBox
              icon={MousePointerClick}
              value={stats?.total_order_clicks ?? 0}
              label="Orders started"
              color="#FF5A1F"
            />
            <StatBox
              icon={TrendingUp}
              value={stats?.order_clicks_7d ?? 0}
              label="This week"
              color="#25D366"
            />
          </div>
          {(stats?.total_views ?? 0) === 0 && (stats?.total_order_clicks ?? 0) === 0 && (
            <p className="mt-3 text-center text-sm text-ink/40">
              Share your link to get your first order.
            </p>
          )}
        </Card>

        {/* 4. QR poster */}
        <Card className="mb-4">
          <h2 className="card-title">QR poster</h2>
          <p className="card-desc">Print this and stick it at your shop. Customers scan to order.</p>

          {/* Style tabs */}
          <div className="mt-3 flex gap-2" role="tablist" aria-label="Poster style">
            {([
              ['bold', 'Bold Sign'],
              ['market', 'Market Stall'],
              ['minimal', 'Minimal'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={posterStyle === value}
                onClick={() => setPosterStyle(value)}
                className={`tap-target rounded-xl px-3.5 text-xs font-bold transition active:scale-[0.97] ${
                  posterStyle === value
                    ? 'bg-ink text-cream shadow-soft'
                    : 'border-2 border-ink/10 bg-white text-ink/60 hover:border-ink/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Preview */}
          {qrDataUrl && (
            <div className="mt-3 flex justify-center rounded-2xl bg-white p-4 shadow-soft">
              <PosterPreview
                style={posterStyle}
                shopName={shop.name}
                shopUrl={shopUrl}
                hours={shop.hours}
                qrDataUrl={qrDataUrl}
                brandColor={shop.brand_color}
                cheapestPrice={cheapestItemPrice}
              />
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                printPoster(
                  {
                    shopName: shop.name,
                    shopUrl,
                    hours: shop.hours,
                    qrDataUrl,
                    brandColor: shop.brand_color,
                    cheapestPrice: cheapestItemPrice,
                  },
                  posterStyle
                )
              }
              className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-cream transition hover:bg-ink/90 active:scale-[0.98]"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print poster
            </button>
            <a
              href={qrDataUrl}
              download={`${shop.slug}-qr.png`}
              className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-ink/10 bg-white px-4 text-sm font-bold text-ink transition hover:border-ink/20 active:scale-[0.98]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download QR
            </a>
          </div>
        </Card>

        {/* 5. Edit shop */}
        <Card className="mb-4">
          <button
            onClick={() => setEditOpen((v) => !v)}
            className="flex w-full items-center justify-between"
            aria-expanded={editOpen}
          >
            <div className="flex items-center gap-2 text-left">
              <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="card-title !mb-0">Edit shop</h2>
            </div>
            {editOpen ? (
              <ChevronUp className="h-5 w-5 text-ink/40" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5 text-ink/40" aria-hidden="true" />
            )}
          </button>

          {!editOpen && (
            <p className="mt-2 text-sm text-ink/50">
              Update your shop name, items, prices, hours, and more.
            </p>
          )}

          {editOpen && (
            <div className="mt-4">
              <ShopForm
                prefill={prefill}
                submitLabel={
                  saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    'Save changes'
                  )
                }
                submitting={saving}
                onSubmit={handleSave}
                submitError={saveError}
                showCatalogPaste={false}
              />
            </div>
          )}
        </Card>

        {/* 6. Keep your private link */}
        <Card className="mb-4 border-2 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600" aria-hidden="true">
              <Bookmark className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="card-title">Keep your private link</h2>
              <p className="card-desc">
                This page is your key. Bookmark it or send it to yourself on WhatsApp so you don't
                lose it.
              </p>

              <div className="mt-3 flex gap-2">
                <a
                  href={selfShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl bg-wa px-4 text-sm font-bold text-white transition hover:bg-wa-dark active:scale-[0.98]"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Send to myself
                </a>
                <button
                  onClick={() => copyLink(manageUrl, setPrivateCopied)}
                  className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-ink/10 bg-white px-4 text-sm font-bold text-ink transition hover:border-ink/20 active:scale-[0.98]"
                >
                  {privateCopied ? (
                    <>
                      <Check className="h-4 w-4 text-wa" aria-hidden="true" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copy private link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <footer className="mt-8 border-t border-ink/5 pt-6 text-center">
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

      {toast && <Toast message={toast} />}
    </div>
  );
}

/* ---------- Loading skeleton ---------- */

function ManageSkeleton() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-7 w-28" />
        </div>
      </header>
      <div className="mx-auto max-w-xl px-5 pt-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="skeleton h-12 w-12 !rounded-2xl" />
          <div className="space-y-2">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="mb-4 rounded-3xl bg-white p-5 shadow-soft">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton mt-2 h-3 w-48" />
            <div className="mt-4 flex gap-2">
              <div className="skeleton h-12 flex-1 !rounded-2xl" />
              <div className="skeleton h-12 flex-1 !rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Reusable card components ---------- */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-5 shadow-soft ${className}`}>
      {children}
      <style>{`
        .card-title {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: #1A1A1A;
          margin-bottom: 0.25rem;
        }
        .card-desc {
          font-size: 0.8125rem;
          color: rgba(26, 26, 26, 0.5);
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-cream p-3 text-center">
      <div
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: color + '15' }}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      <p className="text-xs leading-tight text-ink/50">{label}</p>
    </div>
  );
}

/* ---------- Poster preview (mini on-screen) ---------- */
function PosterPreview({
  style,
  shopName,
  shopUrl,
  hours,
  qrDataUrl,
  brandColor,
  cheapestPrice,
}: {
  style: PosterStyle;
  shopName: string;
  shopUrl: string;
  hours: string;
  qrDataUrl: string;
  brandColor: string;
  cheapestPrice?: number;
}) {
  if (style === 'bold') {
    return (
      <div
        className="flex w-[200px] flex-col items-center justify-center rounded-xl p-5 text-center text-white"
        style={{ backgroundColor: brandColor, aspectRatio: '210/297' }}
      >
        <p className="text-lg font-extrabold leading-none">{shopName}</p>
        <p className="mt-2 text-[10px] font-bold tracking-wider">SCAN TO ORDER</p>
        <div className="mt-3 rounded-xl bg-white p-2">
          <img src={qrDataUrl} alt="QR" className="h-24 w-24" />
        </div>
        <p className="mt-2 text-[9px]">Scan to order on WhatsApp 📲</p>
        <p className="mt-1 text-[7px] opacity-80">{shopUrl}</p>
        <p className="mt-1 text-[8px] opacity-90">{hours}</p>
        <p className="mt-3 text-[7px] opacity-60">Made in 60s with SharpSharp</p>
      </div>
    );
  }

  if (style === 'market') {
    return (
      <div
        className="relative flex w-[200px] flex-col items-center justify-center rounded-xl p-5 text-center"
        style={{ backgroundColor: '#FAF6EF', aspectRatio: '210/297' }}
      >
        {/* Border frame */}
        <div
          className="absolute inset-2 rounded-lg"
          style={{ border: `2px solid ${brandColor}` }}
        />
        {/* Corner triangles */}
        <div className="absolute left-2 top-2 h-5 w-5" style={{ borderTop: `2px solid ${brandColor}`, borderLeft: `2px solid ${brandColor}` }} />
        <div className="absolute right-2 top-2 h-5 w-5" style={{ borderTop: `2px solid ${brandColor}`, borderRight: `2px solid ${brandColor}` }} />
        <div className="absolute bottom-2 left-2 h-5 w-5" style={{ borderBottom: `2px solid ${brandColor}`, borderLeft: `2px solid ${brandColor}` }} />
        <div className="absolute bottom-2 right-2 h-5 w-5" style={{ borderBottom: `2px solid ${brandColor}`, borderRight: `2px solid ${brandColor}` }} />
        {/* Side diamonds */}
        <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45" style={{ backgroundColor: brandColor }} />
        <div className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45" style={{ backgroundColor: brandColor }} />

        <div className="relative z-10 flex flex-col items-center">
          <p className="text-sm font-extrabold text-ink">{shopName}</p>
          {cheapestPrice !== undefined && (
            <span
              className="mt-1.5 -rotate-3 rounded px-2 py-0.5 text-[9px] font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              From ₦{cheapestPrice.toLocaleString('en-NG')}
            </span>
          )}
          <img src={qrDataUrl} alt="QR" className="mt-2.5 h-20 w-20 rounded-lg" />
          <p className="mt-2 text-[9px] font-semibold text-ink">Scan to order on WhatsApp 📲</p>
          <p className="mt-1 text-[7px] text-ink/50">{shopUrl}</p>
          <p className="mt-0.5 text-[8px] text-ink/70">{hours}</p>
          <p className="mt-2 text-[7px] text-ink/40">Made in 60s with SharpSharp</p>
        </div>
      </div>
    );
  }

  // minimal
  return (
    <div
      className="flex w-[200px] flex-col items-center justify-center rounded-xl bg-white p-5 text-center text-black"
      style={{ aspectRatio: '210/297' }}
    >
      <p className="text-sm font-extrabold">{shopName}</p>
      <img src={qrDataUrl} alt="QR" className="mt-3 h-28 w-28" />
      <p className="mt-3 text-[10px] font-semibold">Scan to order on WhatsApp 📲</p>
      <p className="mt-1.5 text-[8px] text-gray-600">{shopUrl}</p>
      <p className="mt-1 text-[9px] text-gray-700">{hours}</p>
      <div className="mt-3 h-px w-20 bg-gray-300" />
      <p className="mt-2 text-[7px] text-gray-400">Made in 60s with SharpSharp</p>
    </div>
  );
}
