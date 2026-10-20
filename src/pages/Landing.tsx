import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  QrCode,
  MessageCircle,
  Utensils,
  Scissors,
  Sparkles,
  Smartphone,
  Cookie,
  ShoppingBag,
  LayoutDashboard,
  X,
} from 'lucide-react';
import HeroPhoneDemo from '@/components/HeroPhoneDemo';
import { getSavedShop, clearSavedShop } from '@/lib/shop';
import { prefersReducedMotion } from '@/lib/motion';

const liveShops = [
  {
    slug: 'mama-ngozi-kitchen',
    name: "Mama Ngozi's Kitchen",
    category: 'Food',
    city: 'Enugu',
    brandColor: '#FF5A1F',
    emoji: '🍲',
    tagline: 'Home-cooked Igbo dishes, packed with love',
  },
  {
    slug: 'chioma-stitches',
    name: 'Chioma Stitches',
    category: 'Fashion & Tailoring',
    city: 'Enugu',
    brandColor: '#7C3AED',
    emoji: '🧵',
    tagline: 'Custom fits, stitched with precision',
  },
  {
    slug: 'gadget-plug-ng',
    name: 'Gadget Plug NG',
    category: 'Phones & Gadgets',
    city: 'Enugu',
    brandColor: '#0EA5E9',
    emoji: '📱',
    tagline: 'Quality accessories, fair prices',
  },
];

const whoFor = [
  { label: 'Food vendors', icon: Utensils },
  { label: 'Tailors', icon: Scissors },
  { label: 'Hair & beauty', icon: Sparkles },
  { label: 'Phone accessories', icon: Smartphone },
  { label: 'Bakers', icon: Cookie },
  { label: 'Thrift stores', icon: ShoppingBag },
];

const steps = [
  {
    icon: ClipboardList,
    title: 'Paste your catalog',
    body: 'Copy your WhatsApp catalog — prices, items, the lot. No formatting headaches.',
  },
  {
    icon: QrCode,
    title: 'Get your link + QR poster',
    body: 'We generate a shareable shop link and a printable QR poster in seconds.',
  },
  {
    icon: MessageCircle,
    title: 'Orders land in your WhatsApp',
    body: 'Customers tap an item, their WhatsApp opens with a pre-filled order to you.',
  },
];

export default function Landing() {
  const [savedShop, setSavedShop] = useState<{ slug: string; token: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setSavedShop(getSavedShop());
  }, []);

  const dismissBanner = () => {
    setBannerDismissed(true);
  };

  const forgetShop = () => {
    clearSavedShop();
    setSavedShop(null);
  };

  const showBanner = savedShop && !bannerDismissed;

  return (
    <div className="min-h-screen bg-cream">
      {/* Continue-to-your-shop banner */}
      {showBanner && (
        <div className="bg-primary text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">
              Welcome back! Your shop is ready.
            </p>
            <Link
              to={`/manage/${savedShop!.slug}?token=${savedShop!.token}`}
              className="tap-target shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-primary transition hover:bg-white/90"
            >
              Go to dashboard →
            </Link>
            <button
              onClick={forgetShop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">SharpSharp</span>
        </div>
        <Link
          to="/create"
          className="tap-target inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98]"
        >
          Make my shop →
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-6 pb-16 md:pt-12 md:pb-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="animate-float-up">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Free · No signup · Naira ready
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-6xl">
              Your business online before your tea gets cold.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink/70 sm:text-lg">
              Paste your WhatsApp catalog. Get a shop link customers can order from, straight
              to your WhatsApp. Free. No signup.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/create"
                className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.98]"
              >
                Make my shop →
              </Link>
              <Link
                to="/s/mama-ngozi-kitchen"
                className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-ink/10 bg-white px-6 text-base font-semibold text-ink transition hover:border-ink/20 active:scale-[0.98]"
              >
                See a live shop
              </Link>
            </div>
          </div>

          <div className="animate-float-up [animation-delay:120ms]">
            <HeroPhoneDemo />
          </div>
        </div>
      </section>

      {/* Price tag marquee */}
      <PriceMarquee />

      {/* Live shops */}
      <section className="bg-cream pb-12 md:pb-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Live shops
              </h2>
              <p className="mt-1 text-sm text-ink/50">
                Tap any shop to see exactly what your customers will see.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {liveShops.map((s) => (
              <Link
                key={s.slug}
                to={`/s/${s.slug}`}
                className="group overflow-hidden rounded-3xl bg-white shadow-soft transition hover:shadow-lift active:scale-[0.98]"
              >
                <div
                  className="flex h-20 items-center gap-3 px-5 text-white"
                  style={{ backgroundColor: s.brandColor }}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold">{s.name}</p>
                    <p className="text-xs text-white/80">{s.category} · {s.city}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <p className="line-clamp-1 text-sm text-ink/60">{s.tagline}</p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Three steps. That's it.
            </h2>
            <p className="mt-3 text-ink/60">
              No website to maintain, no app to download, no dashboard to learn.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-3xl bg-cream p-7 shadow-soft"
              >
                <span className="absolute -top-3 left-7 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-cream">
                  {i + 1}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Who it's for
            </h2>
            <p className="mt-3 text-ink/60">
              If you sell on WhatsApp, SharpSharp works for you.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {whoFor.map((c) => (
              <div
                key={c.label}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink/5 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-soft transition hover:border-primary/30 hover:text-primary"
              >
                <c.icon className="h-4 w-4 text-primary" />
                {c.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-4xl rounded-[2rem] bg-ink p-10 text-center md:p-16">
          <h2 className="font-display text-3xl font-bold text-cream sm:text-4xl">
            Your shop is one paste away.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-cream/60">
            Turn your WhatsApp catalog into a storefront your customers can actually browse.
          </p>
          <Link
            to="/create"
            className="tap-target mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 text-base font-bold text-white transition hover:bg-primary-dark active:scale-[0.98]"
          >
            Make my shop →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold">SharpSharp</span>
          </div>
          <p className="text-sm text-ink/50">
            Built on{' '}
            <a
              href="https://bolt.new"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Bolt
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Price tag marquee ---------- */
const MARQUEE_ITEMS = [
  'Jollof pack ₦2,500',
  'Ankara gown ₦15,000',
  'Type-C cable ₦2,500',
  'Zobo 1L ₦1,200',
  'Braids ₦8,000',
  'Meat pie ₦700',
];

function PriceMarquee() {
  const reduced = prefersReducedMotion();
  const [paused, setPaused] = useState(false);

  // Duplicate items for seamless loop
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <div
      className="overflow-hidden border-y border-ink/5 bg-white py-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex gap-8 whitespace-nowrap"
        style={{
          animation: reduced
            ? 'none'
            : paused
              ? 'none'
              : 'marquee-scroll 30s linear infinite',
        }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70"
          >
            {item}
            <span className="text-primary">•</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
