import { useState } from "react";
import type { Offer } from "../lib/data";
import OfferModal from "./OfferModal";

type Props = {
  offers: Offer[];
  onClose: () => void;
};

export default function CatalogModal({ offers, onClose }: Props) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Matches standard animation times
  };

  return (
    <div className={`offer-backdrop !block ${isClosing ? "opacity-0" : "opacity-100"} transition-opacity duration-300 z-[100]`} style={{ padding: 0 }}>
      <div
        className="w-full h-full flex flex-col bg-newsprint"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-lime px-6 py-4">
          <div className="flex items-center gap-4">
            <h2
              className="text-2xl font-display uppercase tracking-wider text-black"
              style={{ textShadow: "2px 2px 0 #fff" }}
            >
              STORE
            </h2>
          </div>

          <button
            onClick={handleClose}
            aria-label="Close Store"
            data-action-name="Close Store"
            data-action-value="Header Button"
            className="grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-black text-white shadow-[3px_3px_0_#fff] transition hover:rotate-90 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-vermilion"
          >
            <svg width="14" height="14" viewBox="0 0 12 12">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </button>
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-12 pt-8 sm:px-6 md:px-8">
          {offers.length === 0 ? (
            <div className="flex h-full items-center justify-center flex-col opacity-50">
              <p className="font-medium text-black">No offers available at this time.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 justify-items-center">
              {offers.map((offer, i) => (
                <div key={i} className="w-full h-full transform transition-transform hover:-translate-y-2 hover:shadow-[4px_5px_0_#000]">
                  <OfferModal
                    offer={offer}
                    isCatalogMode={true}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
