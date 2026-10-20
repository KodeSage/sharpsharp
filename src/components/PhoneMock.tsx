import { Utensils, Star, MessageCircle } from 'lucide-react';

/**
 * A pure-CSS mock of a phone showing a SharpSharp storefront.
 * Used on the landing page hero — no image, all HTML/CSS.
 */
export default function PhoneMock() {
  return (
    <div className="relative mx-auto" style={{ width: 280 }}>
      {/* Phone frame */}
      <div className="rounded-[2.5rem] bg-ink p-3 shadow-lift">
        {/* Notch */}
        <div className="absolute left-1/2 top-3 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />
        {/* Screen */}
        <div className="overflow-hidden rounded-[2rem] bg-cream" style={{ height: 520 }}>
          {/* Store header band */}
          <div className="bg-primary px-5 pb-5 pt-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <Utensils className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
                Food vendor
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold leading-tight">Mama Ngozi Kitchen</h3>
            <p className="mt-0.5 text-xs text-white/80">Lagos · Mon–Sat, 8am–8pm</p>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-white/90">
              <Star className="h-3 w-3 fill-current" />
              <span>Home-cooked Nigerian meals, fresh daily</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2.5 px-4 py-4">
            {[
              { n: 'Jollof Rice (plate)', p: '₦2,500' },
              { n: 'Egusi Soup & Pounded Yam', p: '₦3,000' },
              { n: 'Suya (10 sticks)', p: '₦2,000' },
            ].map((it) => (
              <div
                key={it.n}
                className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-soft"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{it.n}</p>
                  <p className="text-xs text-ink/50">Tap to order on WhatsApp</p>
                </div>
                <span className="text-sm font-bold text-primary">{it.p}</span>
              </div>
            ))}
          </div>

          {/* WhatsApp button */}
          <div className="px-4 pb-5">
            <div className="flex tap-target items-center justify-center gap-2 rounded-2xl bg-wa font-semibold text-white">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">Order on WhatsApp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
