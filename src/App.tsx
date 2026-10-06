import { useCallback, useEffect, useRef, useState } from "react";
import Sticker from "./components/Sticker";
import OfferModal from "./components/OfferModal";
import CatalogModal from "./components/CatalogModal";
import { buildLayout, OFFERS, type Offer, type StickerItem } from "./lib/data";
import { foley } from "./lib/audio";
import { fetchActiveOffers, fetchActiveCampaignTemplate, type CampaignTemplate } from "./lib/api";
import { useAnalyticsSession } from "./hooks/useAnalyticsSession";
import { trackEvent } from "./lib/analytics";

const FIXED_SIZE = false;

export default function App() {
  const [activeOffers, setActiveOffers] = useState<Offer[]>([]);
  const [items, setItems] = useState<StickerItem[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [autoPeelSchedule, setAutoPeelSchedule] = useState<Record<number, number>>({});
  const [sound, setSound] = useState(false);
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);
  const [template, setTemplate] = useState<CampaignTemplate | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  const removedRef = useRef<number[]>([]);
  const scheduledRef = useRef<Set<number>>(new Set());

  const total = items.length;
  const left = Math.max(0, total - removed.length);
  const blurAmount = total > 0 ? Math.round((left / total) * 12 * 10) / 10 : 0;

  useEffect(() => {
    let mounted = true;
    const domain = window.location.hostname;
    fetchActiveOffers(domain).then(fetchedOffers => {
      if (mounted) {
        setActiveOffers(fetchedOffers);
        const count = fetchedOffers.length > 0 ? fetchedOffers.length : OFFERS.length;
        setItems(buildLayout(
          typeof window !== "undefined" ? window.innerWidth : 1440,
          typeof window !== "undefined" ? window.innerHeight : 900,
          fetchedOffers,
          count,
          FIXED_SIZE
        ));
      }
    });
    fetchActiveCampaignTemplate(domain).then(t => {
      if (mounted) {
        setTemplate(t);
        if (t?.dynamic_title) {
          document.title = t.dynamic_title;
        }
      }
    });
    return () => { mounted = false; };
  }, []);

  useAnalyticsSession({
    domain: typeof window !== "undefined" ? window.location.hostname : undefined,
    campaignSetupId: template?.campaign_setup_id,
    templateId: template?.id,
  });

  useEffect(() => {
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        setItems((prev) => {
          const count = activeOffers.length > 0 ? activeOffers.length : OFFERS.length;
          const next = buildLayout(window.innerWidth, window.innerHeight, activeOffers, count, FIXED_SIZE);
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
  }, [activeOffers]);

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
    const offersList = activeOffers.length > 0 ? activeOffers : OFFERS;
    if (item) {
      const offer = offersList[item.offer % offersList.length];
      setActiveOffer(offer);

      trackEvent({
        event_type: "reveal_shown",
        reveal_type: offer.type,
        reveal_title: offer.value,
      });
    }

    if (next.length >= items.length && items.length > 0) foley.fanfare();
  }, [items, activeOffers]);

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
      {/* Uploaded wallpaper — handles both image and video backgrounds */}
      {template?.default_config?.bgImage && template.default_config.bgImage.match(/\.(mp4|webm|ogg|mov)$/i) ? (
        <video
          className="hero-bg object-cover w-full h-full"
          autoPlay
          loop
          muted
          playsInline
          src={template.default_config.bgImage}
          style={{
            filter: `blur(${blurAmount}px)`,
            transform: left > 0 ? "scale(1.04)" : "scale(1)",
          }}
        />
      ) : (
        <div
          className="hero-bg"
          aria-hidden="true"
          style={{
            filter: `blur(${blurAmount}px)`,
            transform: left > 0 ? "scale(1.04)" : "scale(1)",
            ...(template?.default_config?.bgImage ? { backgroundImage: `url(${template.default_config.bgImage})` } : {})
          }}
        />
      )}

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

      {/* Store toggle — top left corner */}
      <div className="pointer-events-none absolute left-0 top-0 z-50 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setShowCatalog(true)}
          data-action-name="Open Store"
          data-action-value="Top Button"
          className="pointer-events-auto flex items-center justify-center border-2 border-black bg-lime px-4 py-2 font-display text-sm uppercase tracking-wider text-black shadow-[4px_5px_0_#000] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-vermilion active:translate-y-0.5"
        >
          STORE
        </button>
      </div>

      {/* Sound toggle — top right corner */}
      <div className="pointer-events-none absolute right-0 top-0 z-50 p-3 sm:p-4">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "Mute sound" : "Enable sound"}
          data-action-name="Toggle Sound"
          data-action-value={sound ? "Muted" : "Enabled"}
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

      {/* Store modal */}
      {showCatalog && (
        <CatalogModal
          offers={activeOffers.length > 0 ? activeOffers : OFFERS}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {/* PEEL — bottom center */}
      <div className="bottom-controls">
        <button
          type="button"
          onClick={peelOneRandom}
          disabled={left === 0}
          data-action-name="Peel Random"
          data-action-value="Bottom Button"
          className="flex h-12 min-w-28 items-center justify-center border-2 border-black bg-lime px-6 font-display text-sm uppercase tracking-wider text-ink shadow-[4px_5px_0_#000] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-newsprint disabled:cursor-default disabled:opacity-60"
          title={left > 0 ? "Peel one random sticker" : "All stickers peeled"}
        >
          {left > 0 ? "PEEL" : "PEELED"}
        </button>
      </div>
    </main>
  );
}
