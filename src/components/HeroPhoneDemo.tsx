import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring, prefersReducedMotion } from '@/lib/motion';

/* ---------- Types ---------- */
type Phase = 'chat' | 'morph' | 'storefront' | 'tap' | 'hold';

const CHAT_LINES = [
  { name: 'Jollof rice + chicken', price: '₦3,500', priceNum: 3500 },
  { name: 'Small chops (20pcs)', price: '4k', priceNum: 4000 },
  { name: 'Zobo 1L', price: 'N1,200', priceNum: 1200 },
];

const TOTAL_DURATION = 8000;

/* ---------- Phone frame wrapper ---------- */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px]">
      {/* Phone body */}
      <div className="relative rounded-[2.5rem] border-[3px] border-ink/15 bg-ink p-2 shadow-lift">
        {/* Screen */}
        <div className="relative h-[480px] overflow-hidden rounded-[2rem] bg-cream">
          {/* Notch */}
          <div className="absolute left-1/2 top-0 z-30 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-ink" />
          {children}
        </div>
      </div>
      {/* Side buttons */}
      <div className="absolute -left-[5px] top-24 h-12 w-[3px] rounded-l-sm bg-ink/20" />
      <div className="absolute -left-[5px] top-40 h-12 w-[3px] rounded-l-sm bg-ink/20" />
      <div className="absolute -right-[5px] top-32 h-16 w-[3px] rounded-r-sm bg-ink/20" />
    </div>
  );
}

/* ---------- Price chip ---------- */
function PriceChip({ price, highlighted }: { price: string; highlighted: boolean }) {
  return (
    <motion.span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
      animate={{
        backgroundColor: highlighted ? '#FF5A1F' : 'rgba(26,26,26,0.06)',
        color: highlighted ? '#FFFFFF' : 'rgba(26,26,26,0.7)',
      }}
      transition={highlighted ? spring : { duration: 0.2 }}
    >
      {price}
    </motion.span>
  );
}

/* ---------- Chat phase: typing out lines ---------- */
function ChatPhase({
  visibleLines,
  highlightedIndex,
}: {
  visibleLines: number;
  highlightedIndex: number;
}) {
  return (
    <div className="flex h-full flex-col bg-[#E5DDD5]">
      {/* Chat header */}
      <div className="flex items-center gap-2 bg-[#F0F0F0] px-4 pb-2 pt-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5A1F] text-xs font-bold text-white">
          M
        </div>
        <span className="text-sm font-semibold text-ink">My Shop Catalog</span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-hidden px-3 py-3">
        {CHAT_LINES.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion() ? { duration: 0 } : spring}
            className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 shadow-sm"
          >
            <p className="text-xs leading-relaxed text-ink">
              {line.name} –{' '}
              <PriceChip price={line.price} highlighted={highlightedIndex === i} />
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Storefront phase ---------- */
function StorefrontPhase({
  visibleCards,
  tapCount,
  showCart,
}: {
  visibleCards: number;
  tapCount: number;
  showCart: boolean;
}) {
  const reduced = prefersReducedMotion();

  return (
    <div className="flex h-full flex-col bg-cream">
      {/* Orange header */}
      <div className="bg-[#FF5A1F] px-4 pb-3 pt-8 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            M
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Mama Ngozi's Kitchen</p>
            <p className="text-[10px] text-white/80">Food · Enugu</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2 overflow-hidden px-3 py-3">
        {CHAT_LINES.slice(0, visibleCards).map((item, i) => (
          <motion.div
            key={i}
            custom={i}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { ...spring, delay: i * 0.08 }
            }
            className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A1F]/10 text-lg">
              {i === 0 ? '🍛' : i === 1 ? '🥟' : '🧃'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
              <p className="text-xs font-bold tabular-nums text-[#FF5A1F]">{item.price}</p>
            </div>
            {/* Add button or qty */}
            {i === 0 && tapCount > 0 ? (
              <motion.div
                className="flex items-center gap-1 rounded-lg border border-ink/10 bg-white p-0.5"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduced ? { duration: 0 } : spring}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded text-ink">−</span>
                <span className="w-3 text-center text-xs font-bold tabular-nums text-ink">{tapCount}</span>
                <span className="flex h-6 w-6 items-center justify-center rounded text-ink">+</span>
              </motion.div>
            ) : (
              <div
                className={`rounded-lg bg-ink px-2.5 py-1 text-xs font-bold text-cream ${
                  i === 0 ? 'relative' : ''
                }`}
              >
                Add
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Tap indicator */}
      {tapCount < 2 && visibleCards >= 3 && (
        <motion.div
          className="absolute"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.3 }}
          style={{
            right: '24px',
            top: `${200 + visibleCards * 52}px`,
          }}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF5A1F]/30">
            <div className="h-3 w-3 rounded-full bg-[#FF5A1F]" />
          </div>
        </motion.div>
      )}

      {/* Cart bar */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            className="px-3 pb-3"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={reduced ? { duration: 0 } : spring}
          >
            <div className="flex items-center gap-2 rounded-xl bg-ink p-2.5 shadow-lift">
              <span className="flex-1 pl-1 text-xs font-semibold text-cream tabular-nums">
                2 items · ₦7,500
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">
                Order
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Static final frame (reduced motion) ---------- */
function StaticFrame() {
  return (
    <div className="flex h-full flex-col bg-cream">
      <div className="bg-[#FF5A1F] px-4 pb-3 pt-8 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            M
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Mama Ngozi's Kitchen</p>
            <p className="text-[10px] text-white/80">Food · Enugu</p>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2 px-3 py-3">
        {CHAT_LINES.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A1F]/10 text-lg">
              {i === 0 ? '🍛' : i === 1 ? '🥟' : '🧃'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
              <p className="text-xs font-bold tabular-nums text-[#FF5A1F]">{item.price}</p>
            </div>
            {i === 0 ? (
              <div className="flex items-center gap-1 rounded-lg border border-ink/10 bg-white p-0.5">
                <span className="flex h-6 w-6 items-center justify-center rounded text-ink">−</span>
                <span className="w-3 text-center text-xs font-bold tabular-nums text-ink">2</span>
                <span className="flex h-6 w-6 items-center justify-center rounded text-ink">+</span>
              </div>
            ) : (
              <div className="rounded-lg bg-ink px-2.5 py-1 text-xs font-bold text-cream">Add</div>
            )}
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-ink p-2.5 shadow-lift">
          <span className="flex-1 pl-1 text-xs font-semibold text-cream tabular-nums">
            2 items · ₦7,500
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">
            Order
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function HeroPhoneDemo() {
  const [phase, setPhase] = useState<Phase>('chat');
  const [visibleLines, setVisibleLines] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [visibleCards, setVisibleCards] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduced = prefersReducedMotion();

  // IntersectionObserver to pause when off-screen
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Clear all pending timeouts
  const clearTimers = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  };

  const scheduleTimer = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timeoutRefs.current.push(t);
  };

  // Run the animation loop
  useEffect(() => {
    if (reduced) return;
    if (!isVisible) {
      clearTimers();
      return;
    }

    function runLoop() {
      clearTimers();

      // Reset
      setPhase('chat');
      setVisibleLines(0);
      setHighlightedIndex(-1);
      setVisibleCards(0);
      setTapCount(0);
      setShowCart(false);

      // Phase 1: Chat — type out 3 lines (0–3s)
      // Line 1 appears at 200ms, highlighted at 500ms
      scheduleTimer(() => setVisibleLines(1), 200);
      scheduleTimer(() => setHighlightedIndex(0), 600);
      // Line 2 at 1000ms, highlighted at 1400ms
      scheduleTimer(() => setVisibleLines(2), 1000);
      scheduleTimer(() => setHighlightedIndex(1), 1400);
      // Line 3 at 1800ms, highlighted at 2200ms
      scheduleTimer(() => setVisibleLines(3), 1800);
      scheduleTimer(() => setHighlightedIndex(2), 2200);

      // Phase 2: Morph — lines lift into cards (2400ms)
      scheduleTimer(() => {
        setPhase('morph');
        setVisibleCards(1);
      }, 2400);
      scheduleTimer(() => setVisibleCards(2), 2480);
      scheduleTimer(() => setVisibleCards(3), 2560);
      scheduleTimer(() => setPhase('storefront'), 2700);

      // Phase 3: Tap — tap Add twice (3200ms)
      scheduleTimer(() => {
        setPhase('tap');
        setTapCount(1);
      }, 3200);
      scheduleTimer(() => setTapCount(2), 3700);

      // Phase 4: Cart bar slides up (3900ms)
      scheduleTimer(() => setShowCart(true), 3900);

      // Phase 5: Hold 1.5s then crossfade back (5400ms)
      scheduleTimer(() => setPhase('hold'), 5400);

      // Loop back at 8s
      scheduleTimer(() => runLoop(), TOTAL_DURATION);
    }

    runLoop();

    return clearTimers;
  }, [isVisible, reduced]);

  // Reduced motion: show static frame
  if (reduced) {
    return (
      <div ref={containerRef}>
        <PhoneFrame>
          <StaticFrame />
        </PhoneFrame>
      </div>
    );
  }

  // Determine which screen to show
  const showChat = phase === 'chat';

  return (
    <div ref={containerRef}>
      <PhoneFrame>
        <AnimatePresence mode="wait">
          {showChat ? (
            <motion.div
              key="chat"
              className="h-full"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChatPhase visibleLines={visibleLines} highlightedIndex={highlightedIndex} />
            </motion.div>
          ) : (
            <motion.div
              key="store"
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StorefrontPhase
                visibleCards={visibleCards}
                tapCount={tapCount}
                showCart={showCart}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </PhoneFrame>
    </div>
  );
}
