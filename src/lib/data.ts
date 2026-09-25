export type Offer = {
  type: "discount" | "freebie" | "deal" | "reward";
  value: string;
  code: string;
  blurb: string;
};

export const OFFERS: Offer[] = [
  { type: "discount", value: "40% OFF", code: "STRIKE40", blurb: "40% off all football boots & cleats" },
  { type: "freebie", value: "FREE JERSEY", code: "KIT11", blurb: "Free club jersey on orders over ₹4999" },
  { type: "discount", value: "₹1000 OFF", code: "GOAL1000", blurb: "Flat ₹1000 off the new speed range" },
  { type: "deal", value: "BUY 1 GET 1", code: "BOGOKICK", blurb: "Buy any boots, get shin guards free" },
  { type: "freebie", value: "FREE SOCKS", code: "GRIP7", blurb: "Free grip socks with every purchase" },
  { type: "discount", value: "15% OFF", code: "PRO15", blurb: "15% off all pro training gear" },
  { type: "reward", value: "MYSTERY BOX", code: "GOLDEN10", blurb: "Unlock a surprise player-edition drop" },
  { type: "deal", value: "FREE SHIPPING", code: "FASTLANE", blurb: "Free next-day delivery, no minimum" },
  { type: "reward", value: "LUCKY SPIN", code: "SPIN99", blurb: "One free spin to win match tickets" },
  { type: "discount", value: "30% OFF", code: "TURF30", blurb: "30% off turf shoes & astro trainers" },
  { type: "freebie", value: "FREE BALL", code: "MATCH1", blurb: "Free match ball on boots over ₹7999" },
  { type: "deal", value: "VIP DROP", code: "EARLYKICK", blurb: "Early access to the next boot launch" },
];

export type StickerItem = {
  id: number;
  x: number;
  y: number;
  d: number;
  rot: number;
  pal: number;
  kind: 0 | 1;
  teaser: string;
  offer: number;
};

/* deterministic RNG so a given viewport always yields the same wall */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 0 vermilion · 1 ink · 2 lime · 3 newsprint · 4 ochre · 5 deep red · 6 coral */
const PALETTE_POOL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 0, 1];

const TEASERS = [
  "PEEL ME",
  "PEEL ME",
  "OFFER",
  "STRIKE",
  "GOAL",
  "PEEL ME",
  "COUPON",
];

export function buildLayout(vw: number, vh: number): StickerItem[] {
  const mobile = vw < 720;
  const spacing = mobile ? 92 : vw < 1120 ? 120 : 136;
  /* Larger diameter than grid spacing so round stickers overlap and genuinely hide the ad underneath */
  const dBase = spacing * (mobile ? 1.24 : 1.28);
  const padX = mobile ? 4 : 8;
  const padTop = mobile ? 56 : 58;
  const padBot = mobile ? 8 : 10;
  const maxCount = mobile ? 44 : 76;
  const minCount = mobile ? 36 : 48;

  const rand = mulberry32(Math.round(vw) * 7919 + Math.round(vh) * 104729 + 19);
  const placed: { x: number; y: number; d: number }[] = [];
  const items: StickerItem[] = [];

  const fits = (x: number, y: number, d: number, minFactor = 0.56) => {
    if (x - d * 0.35 < padX || x + d * 0.35 > vw - padX) return false;
    if (y - d * 0.35 < padTop || y + d * 0.35 > vh - padBot) return false;
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const min = minFactor * ((d + p.d) / 2);
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy < min * min) return false;
    }
    return true;
  };

  const push = (x: number, y: number, d: number, offer: number) => {
    const id = items.length;
    const pal = PALETTE_POOL[Math.floor(rand() * PALETTE_POOL.length)];
    const kind: 0 | 1 = rand() < 0.48 ? 1 : 0;
    placed.push({ x, y, d });
    items.push({
      id,
      x,
      y,
      d,
      rot: Math.round((rand() * 2 - 1) * 24),
      pal,
      kind,
      teaser: kind === 1 ? OFFERS[offer].value : TEASERS[Math.floor(rand() * TEASERS.length)],
      offer,
    });
  };

  const availW = Math.max(200, vw - padX * 2);
  const availH = Math.max(200, vh - padTop - padBot);
  const cols = Math.max(3, Math.round(availW / spacing));
  const rows = Math.max(3, Math.round(availH / spacing));
  const sx = availW / cols;
  const sy = availH / rows;
  const y0 = padTop + sy / 2;
  const x0 = padX + sx / 2;

  let offerCursor = Math.floor(rand() * OFFERS.length);
  const nextOffer = () => {
    const o = offerCursor % OFFERS.length;
    offerCursor += 1 + (rand() < 0.35 ? 1 : 0);
    return o;
  };

  for (let r = 0; r < rows; r++) {
    const rowShift = (r % 2) * sx * 0.42 + (rand() - 0.5) * sx * 0.18;
    for (let c = 0; c < cols; c++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const jx = (rand() - 0.5) * 2 * sx * (0.14 + attempt * 0.05);
        const jy = (rand() - 0.5) * 2 * sy * (0.14 + attempt * 0.05);
        const x = Math.min(vw - padX - 24, Math.max(padX + 24, x0 + c * sx + rowShift + jx));
        const y = Math.min(vh - padBot - 24, Math.max(padTop + 24, y0 + r * sy + jy));
        const d = dBase * (0.92 + rand() * 0.22);
        if (fits(x, y, d, 0.56)) {
          push(x, y, d, nextOffer());
          break;
        }
      }
    }
  }

  /* Organic fill pass — fills gaps so the underlying ad is well covered initially */
  for (let attempt = 0; attempt < 950 && items.length < maxCount; attempt++) {
    const x = padX + 24 + rand() * (availW - 48);
    const y = padTop + 24 + rand() * (availH - 48);
    const d = dBase * (0.86 + rand() * 0.28);
    if (fits(x, y, d, 0.52)) push(x, y, d, nextOffer());
  }

  if (items.length < minCount) {
    for (let attempt = 0; attempt < 500 && items.length < minCount; attempt++) {
      const x = padX + 20 + rand() * (availW - 40);
      const y = padTop + 20 + rand() * (availH - 40);
      const d = dBase * (0.78 + rand() * 0.24);
      if (fits(x, y, d, 0.44)) push(x, y, d, nextOffer());
    }
  }

  return items;
}
