import { useCallback, useEffect, useRef, useState } from "react";
import Sticker from "./components/Sticker";
import OfferModal from "./components/OfferModal";
import { buildLayout, OFFERS, type Offer, type StickerItem } from "./lib/data";
import { foley } from "./lib/audio";

export default function App() {
  const [items, setItems] = useState<StickerItem[]>(() =>
    buildLayout(
      typeof window !== "undefined" ? window.innerWidth : 1440,
      typeof window !== "undefined" ? window.innerHeight : 900,
    ),
  );
  const [removed, setRemoved] = useState<number[]>([]);
  const [autoPeelSchedule, setAutoPeelSchedule] = useState<Record<number, number>>({});
  const [sound, setSound] = useState(false);
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);

  const removedRef = useRef<number[]>([]);
  const scheduledRef = useRef<Set<number>>(new Set());

  const total = items.length;
  const left = Math.max(0, total - removed.length);
  const blurAmount = total > 0 ? Math.round((left / total) * 12 * 10) / 10 : 0;

  useEffect(() => {
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        setItems((prev) => {
          const next = buildLayout(window.innerWidth, window.innerHeight);
          if (Math.abs(next.length - prev.length) <= 2 && prev.length > 0) return prev;
          removedRef.current = [];
          scheduledRef.current.clear();
          setRemoved([]);
          setAutoPeelSchedule({});
          return next;
        });
      }, 260);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const handleStart = useCallback((id: number) => {
    scheduledRef.current.add(id);
  }, []);

  const handleAbort = useCallback(() => {
    /* snap-back — nothing extra to show */
  }, []);

  const handleComplete = useCallback((id: number) => {
    scheduledRef.current.delete(id);
    if (removedRef.current.indexOf(id) !== -1) return;
    const next = [...removedRef.current, id];
    removedRef.current = next;
    setRemoved(next);

    /* Reveal the offer + coupon hidden under this sticker */
    const item = items.find((it) => it.id === id);
    if (item) setActiveOffer(OFFERS[item.offer % OFFERS.length]);

    if (next.length >= items.length && items.length > 0) foley.fanfare();
  }, [items]);

  const peelOneRandom = useCallback(() => {
    foley.click();
    const available = items.filter(
      (it) => !removedRef.current.includes(it.id) && !scheduledRef.current.has(it.id),
    );
    if (available.length === 0) return;
    const chosen = available[Math.floor(Math.random() * available.length)];
    scheduledRef.current.add(chosen.id);
    setAutoPeelSchedule((prev) => ({ ...prev, [chosen.id]: performance.now() }));
  }, [items]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    foley.setEnabled(next);
    if (next) foley.click();
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      {/* Uploaded wallpaper — the only background */}
      <div
        className="hero-bg"
        aria-hidden="true"
        style={{
          filter: `blur(${blurAmount}px)`,
          transform: left > 0 ? "scale(1.04)" : "scale(1)",
        }}
      />

      {/* Round sticker labels covering the image */}
      <div className="absolute inset-0 z-10">
        {items.map((it) => (
          <Sticker
            key={it.id}
            item={it}
            removed={removed.includes(it.id)}
            autoPeelAt={autoPeelSchedule[it.id]}
            onStart={handleStart}
            onComplete={handleComplete}
            onAbort={handleAbort}
          />
        ))}
      </div>

      {/* Sound toggle — top right corner */}
      <div className="pointer-events-none absolute right-0 top-0 z-50 p-3 sm:p-4">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "Mute sound" : "Enable sound"}
          className="pointer-events-auto grid h-11 w-11 place-items-center border-2 border-black bg-newsprint shadow-[4px_5px_0_#000] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="#1A1614" />
            {sound ? (
              <>
                <path d="M15.5 9c1.2 1 1.2 5 0 6" stroke="#E23D28" strokeWidth="2" strokeLinecap="round" />
                <path d="M18 6.5c2.6 2.2 2.6 8.8 0 11" stroke="#E23D28" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              <path d="M16 9.5l5 5m0-5l-5 5" stroke="#E23D28" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Offer + coupon modal shown after each peel */}
      {activeOffer && <OfferModal offer={activeOffer} onClose={() => setActiveOffer(null)} />}

      {/* PEEL — bottom center */}
      <div className="bottom-controls">
        <button
          type="button"
          onClick={peelOneRandom}
          disabled={left === 0}
          className="flex h-12 min-w-28 items-center justify-center border-2 border-black bg-lime px-6 font-display text-sm uppercase tracking-wider text-ink shadow-[4px_5px_0_#000] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-newsprint disabled:cursor-default disabled:opacity-60"
          title={left > 0 ? "Peel one random sticker" : "All stickers peeled"}
        >
          {left > 0 ? "PEEL" : "PEELED"}
        </button>
      </div>
    </main>
  );
}
