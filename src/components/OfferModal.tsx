import { useEffect, useState } from "react";
import type { Offer } from "../lib/data";
import { foley } from "../lib/audio";

type Props = {
  offer: Offer;
  onClose?: () => void;
  isCatalogMode?: boolean;
};



export default function OfferModal({ offer, onClose, isCatalogMode }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isCatalogMode || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isCatalogMode]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(offer.code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = offer.code;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    foley.click();
    window.setTimeout(() => setCopied(false), 1800);
  };

  const content = (
      <div className={`offer-card ${isCatalogMode ? "!w-full !max-w-full h-full flex flex-col" : ""}`}>
        {/* close */}
        {!isCatalogMode && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-action-name="Close Offer"
            data-action-value={offer.brand || offer.value}
            className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-black bg-black text-white shadow-[3px_3px_0_#39FF14] transition hover:rotate-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime"
          >
            <svg width="14" height="14" viewBox="0 0 12 12">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </button>
        )}

        {/* confetti dots */}
        {!isCatalogMode && (
          <div className="offer-spark" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ ["--i" as string]: i }} />
            ))}
          </div>
        )}

        <div className="text-center flex flex-col flex-1">
          {!isCatalogMode && <div className="text-4xl">🎉</div>}
          <div className={`${isCatalogMode ? "mt-0" : "mt-1"} font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-vermilion`}>
            {[
              offer.type,
              offer.category,
              offer.brand
            ].filter(Boolean).join(" • ")}
          </div>

          <div
            className="mt-2 font-display uppercase leading-[0.85] text-black"
            style={{ 
              fontSize: isCatalogMode ? "clamp(1.8rem, 4vw, 2.4rem)" : "clamp(2.4rem, 9vw, 3.6rem)", 
              textShadow: "3px 3px 0 #39FF14" 
            }}
          >
            {offer.value}
          </div>

          <p className="mx-auto mt-2.5 max-w-[34ch] text-sm font-medium leading-snug text-black/75">
            {offer.blurb}
          </p>

          {/* coupon */}
          <div className={`coupon ${isCatalogMode ? "mt-auto" : ""}`}>
            <span className="coupon-notch coupon-notch-l" aria-hidden="true" />
            <span className="coupon-notch coupon-notch-r" aria-hidden="true" />
            <div className="text-left">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-black/55">
                Coupon Code
              </div>
              <div className="font-mono text-2xl font-bold tracking-[0.14em] text-black">
                {offer.code}
              </div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              data-action-name="Copy Code"
              data-action-value={offer.brand || offer.value}
              className="shrink-0 border-2 border-black bg-black px-4 py-2.5 font-display text-xs uppercase tracking-wider text-lime shadow-[3px_3px_0_#39FF14] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime active:translate-y-0.5"
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </div>

          {!isCatalogMode && onClose && (
            <button
              type="button"
              onClick={onClose}
              data-action-name="Keep Peeling"
              data-action-value={offer.brand || offer.value}
              className="mt-5 w-full border-2 border-black bg-lime px-6 py-3 font-display text-sm uppercase tracking-wider text-black shadow-[4px_5px_0_#000] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-vermilion active:translate-y-0.5"
            >
              KEEP PEELING →
            </button>
          )}
        </div>
      </div>
  );

  if (isCatalogMode) return content;

  return (
    <div
      className="offer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="You unlocked an offer"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {content}
    </div>
  );
}
