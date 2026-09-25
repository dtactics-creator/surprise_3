import { useEffect, useState } from "react";
import type { Offer } from "../lib/data";
import { foley } from "../lib/audio";

type Props = {
  offer: Offer;
  onClose: () => void;
};

const TYPE_LABEL: Record<Offer["type"], string> = {
  discount: "DISCOUNT UNLOCKED",
  freebie: "FREEBIE UNLOCKED",
  deal: "DEAL UNLOCKED",
  reward: "REWARD UNLOCKED",
};

export default function OfferModal({ offer, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  return (
    <div
      className="offer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="You unlocked an offer"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="offer-card">
        {/* close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-black bg-black text-white shadow-[3px_3px_0_#39FF14] transition hover:rotate-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime"
        >
          <svg width="14" height="14" viewBox="0 0 12 12">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2.4" />
          </svg>
        </button>

        {/* confetti dots */}
        <div className="offer-spark" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} style={{ ["--i" as string]: i }} />
          ))}
        </div>

        <div className="text-center">
          <div className="text-4xl">🎉</div>
          <div className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-vermilion">
            {TYPE_LABEL[offer.type]}
          </div>

          <div
            className="mt-2 font-display uppercase leading-[0.85] text-black"
            style={{ fontSize: "clamp(2.4rem, 9vw, 3.6rem)", textShadow: "3px 3px 0 #39FF14" }}
          >
            {offer.value}
          </div>

          <p className="mx-auto mt-2.5 max-w-[34ch] text-sm font-medium leading-snug text-black/75">
            {offer.blurb}
          </p>

          {/* coupon */}
          <div className="coupon">
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
              className="shrink-0 border-2 border-black bg-black px-4 py-2.5 font-display text-xs uppercase tracking-wider text-lime shadow-[3px_3px_0_#39FF14] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime active:translate-y-0.5"
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full border-2 border-black bg-lime px-6 py-3 font-display text-sm uppercase tracking-wider text-black shadow-[4px_5px_0_#000] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-vermilion active:translate-y-0.5"
          >
            KEEP PEELING →
          </button>
        </div>
      </div>
    </div>
  );
}
