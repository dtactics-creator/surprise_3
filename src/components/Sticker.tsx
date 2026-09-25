import { useCallback, useEffect, useRef, useState } from "react";
import type { StickerItem } from "../lib/data";
import { foley } from "../lib/audio";

export const PAL = [
  { bg: "#E11D2E", fg: "#FFF4C4" },
  { bg: "#111111", fg: "#39FF14" },
  { bg: "#39FF14", fg: "#111111" },
  { bg: "#FFD200", fg: "#111111" },
  { bg: "#FF8A00", fg: "#111111" },
  { bg: "#7A0C16", fg: "#FFD200" },
  { bg: "#F5F0E6", fg: "#E11D2E" },
];

const R3 = (n: number) => Math.round(n * 10) / 10;

type Props = {
  item: StickerItem;
  removed: boolean;
  autoPeelAt?: number;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onAbort: () => void;
};

export default function Sticker({
  item,
  removed,
  autoPeelAt,
  onStart,
  onComplete,
  onAbort,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stuckRef = useRef<HTMLDivElement>(null);
  const creaseRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const [active, setActive] = useState(false);
  const [hover, setHover] = useState(false);

  const st = useRef({
    p: 0,
    fade: 1,
    fx: 0,
    fy: 0,
    spin: 0,
    lift: 0,
    phi: -Math.PI * 0.28,
    dragging: false,
    busy: false,
    downAt: 0,
    sx: 0,
    sy: 0,
    dx: 0,
    dy: 0,
  }).current;

  const pal = PAL[item.pal];
  const r = item.d / 2;
  const words = item.teaser.split(" ");
  const maxLen = words.reduce((m, w) => Math.max(m, w.length), 1);
  const tSize = Math.min(
    item.d * 0.21,
    (item.d * 0.78) / (maxLen * 0.62),
    (item.d * 0.38) / (0.88 * words.length),
  );

  const render = useCallback(() => {
    const stuck = stuckRef.current;
    const flap = flapRef.current;
    const crease = creaseRef.current;
    if (!stuck || !flap) return;

    const p = Math.max(0, Math.min(1, st.p));
    const phiDeg = (st.phi * 180) / Math.PI;
    const c = Math.cos(st.phi);
    const s = Math.sin(st.phi);

    if (p <= 0.001 && Math.abs(st.fx) + Math.abs(st.fy) < 0.4) {
      stuck.style.clipPath = "none";
      flap.style.opacity = "0";
      flap.style.transform = "none";
      flap.style.filter = "none";
      if (crease) crease.style.opacity = "0";
      if (shadeRef.current) shadeRef.current.style.opacity = "0";
      return;
    }

    /*
     * k sweeps from -r (leading edge where peel starts) to +r (far edge).
     * - u < k is already peeled away -> transparent, directly revealing the background poster underneath!
     * - u >= k is still adhered -> `stuck`
     * - `flap` is the peeled region u <= k folded ACROSS the line u = k onto u >= k
     */
    const k = -r + p * 2 * r;
    const pt = (u: number, v: number) => `${R3(r + u * c - v * s)}px ${R3(r + u * s + v * c)}px`;

    const peeledPoly = `polygon(${pt(-3 * r, -2 * r)}, ${pt(k, -2 * r)}, ${pt(k, 2 * r)}, ${pt(-3 * r, 2 * r)})`;
    const stuckPoly = `polygon(${pt(k, -2 * r)}, ${pt(3 * r, -2 * r)}, ${pt(3 * r, 2 * r)}, ${pt(k, 2 * r)})`;

    stuck.style.clipPath = stuckPoly;
    flap.style.clipPath = peeledPoly;

    if (crease) {
      /* Contact shadow the lifted flap throws onto the part still stuck to the wall */
      crease.style.opacity = String(Math.min(0.92, p * 1.35) * st.fade);
      crease.style.clipPath = stuckPoly;
      const pct = Math.max(0, Math.min(100, ((k + r) / (2 * r)) * 100));
      const soft = 8 + p * 10;
      crease.style.background = `linear-gradient(${R3(phiDeg + 90)}deg, transparent ${R3(Math.max(0, pct - 2.5))}%, rgba(10,8,6,${R3((0.5 + p * 0.14) * 100) / 100}) ${R3(pct)}%, rgba(10,8,6,0.18) ${R3(pct + soft)}%, transparent ${R3(pct + soft * 2.4)}%)`;
    }

    const pfx = k * c;
    const pfy = k * s;
    const foldDeg = 152 + p * 24;
    const scale = 1 + p * 0.04 + st.lift * 0.09;

    flap.style.opacity = String(st.fade);
    flap.style.transform = [
      `translate3d(${R3(st.fx)}px, ${R3(st.fy)}px, 0px)`,
      `rotate(${R3(st.spin)}deg)`,
      `scale(${R3(scale * 100) / 100})`,
      `translate(${R3(pfx)}px, ${R3(pfy)}px)`,
      `rotate(${R3(phiDeg)}deg)`,
      `rotateY(${R3(foldDeg)}deg)`,
      `rotate(${R3(-phiDeg)}deg)`,
      `translate(${R3(-pfx)}px, ${R3(-pfy)}px)`,
    ].join(" ");

    /* Shadow lifts away from the wall as the flap rises and flies off */
    const g = Math.max(p * 0.6, st.lift);
    flap.style.filter = `drop-shadow(${R3(2 + g * 12)}px ${R3(4 + g * 18)}px ${R3(5 + g * 14)}px rgba(0,0,0,${R3((0.32 + g * 0.26) * 100) / 100}))`;

    if (shadeRef.current) {
      /* Specular curl highlight racing along the fold */
      shadeRef.current.style.opacity = "1";
      const hi = 40 + p * 14;
      shadeRef.current.style.background = `linear-gradient(${R3(phiDeg + 90)}deg, rgba(26,22,20,0.3) 0%, rgba(255,255,255,0.55) ${R3(hi - 9)}%, rgba(255,255,255,0.95) ${R3(hi)}%, rgba(255,255,255,0.4) ${R3(hi + 8)}%, rgba(26,22,20,0.2) 82%, rgba(26,22,20,0.42) 100%)`;
    }
  }, [r, st]);

  const animate = useCallback(
    (dur: number, ease: (t: number) => number, step: (t: number) => void, done?: () => void) => {
      cancelAnimationFrame(rafRef.current);
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        step(ease(t));
        render();
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else done && done();
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [render],
  );

  const finish = useCallback(() => {
    st.busy = false;
    st.dragging = false;
    setActive(false);
    foley.peelStop();
    if (wrapRef.current) wrapRef.current.classList.remove("peeling");
    onComplete(item.id);
  }, [item.id, onComplete, st]);

  const completeFromCurrent = useCallback(() => {
    st.dragging = false;
    st.busy = true;
    const p0 = Math.max(0.24, st.p);
    const fx0 = st.fx;
    const fy0 = st.fy;
    /* Throw the flap off along the peel direction with a slight upward arc and spin */
    const dirx = Math.cos(st.phi);
    const diry = Math.sin(st.phi);
    const throwDist = item.d * (1.0 + Math.random() * 0.35);
    const spinTarget = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 20);
    animate(
      560,
      (t) => 1 - Math.pow(1 - t, 3),
      (t) => {
        /* finish detaching in the first half, then fly free */
        st.p = Math.min(1, p0 + (1 - p0) * Math.min(1, t / 0.52));
        const fly = Math.max(0, (t - 0.3) / 0.7);
        st.lift = fly;
        st.spin = spinTarget * fly;
        st.fx = fx0 + (dirx * throwDist - fx0) * t;
        st.fy = fy0 + (diry * throwDist - fy0) * t - fly * item.d * 0.22;
        st.fade = t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.38);
        foley.peelUpdate(st.p);
      },
      () => {
        st.fade = 1;
        st.lift = 0;
        st.spin = 0;
        foley.pop();
        finish();
      },
    );
  }, [animate, finish, item.d, st]);

  const autoPeel = useCallback(() => {
    if (st.busy || removed) return;
    st.busy = true;
    st.dragging = false;
    st.phi = -Math.PI * 0.25 + (Math.random() - 0.5) * 1.1;
    st.fade = 1;
    setActive(true);
    if (wrapRef.current) wrapRef.current.classList.add("peeling");
    foley.peelStart();
    onStart(item.id);
    const dirx = Math.cos(st.phi);
    const diry = Math.sin(st.phi);
    const throwDist = item.d * (0.95 + Math.random() * 0.3);
    const spinTarget = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18);
    animate(
      680,
      (t) => 1 - Math.pow(1 - t, 3),
      (t) => {
        /* slow grab at the corner, quick rip through the middle, then fly off */
        st.p = Math.min(1, t / 0.62);
        const fly = Math.max(0, (t - 0.42) / 0.58);
        st.lift = fly;
        st.spin = spinTarget * fly;
        st.fx = dirx * (t * item.d * 0.42 + fly * throwDist * 0.55);
        st.fy = diry * (t * item.d * 0.42 + fly * throwDist * 0.55) - fly * item.d * 0.2;
        st.fade = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
        foley.peelUpdate(st.p);
      },
      () => {
        st.fade = 1;
        st.lift = 0;
        st.spin = 0;
        foley.pop();
        finish();
      },
    );
  }, [animate, finish, item.d, item.id, onStart, removed, st]);

  useEffect(() => {
    if (!autoPeelAt || removed) return;
    const delay = Math.max(0, autoPeelAt - performance.now());
    const timer = window.setTimeout(() => {
      autoPeel();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoPeel, autoPeelAt, removed]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const onDown = (e: React.PointerEvent) => {
    if (removed || st.dragging) return;
    cancelAnimationFrame(rafRef.current);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ox = e.clientX - (rect.left + rect.width / 2);
    const oy = e.clientY - (rect.top + rect.height / 2);
    /* Lift from the pressed edge toward the opposite side */
    st.phi = Math.hypot(ox, oy) > 8 ? Math.atan2(-oy, -ox) : -Math.PI * 0.28;

    st.busy = true;
    st.dragging = true;
    st.downAt = performance.now();
    st.fade = 1;
    st.spin = 0;
    st.lift = 0;
    st.fx = 0;
    st.fy = 0;
    st.sx = e.clientX;
    st.sy = e.clientY;
    st.dx = 0;
    st.dy = 0;
    setActive(true);
    if (wrapRef.current) wrapRef.current.classList.add("peeling");
    foley.peelStart();
    onStart(item.id);

    /* Immediately curl the corner up with a springy grab so the lift feels alive */
    animate(
      170,
      (t) => {
        const c3 = 1.4;
        const u = t - 1;
        return 1 + (c3 + 1) * u * u * u + c3 * u * u;
      },
      (t) => {
        if (st.dragging && Math.hypot(st.dx, st.dy) < 6) {
          st.p = Math.max(0, 0.26 * t);
        }
      },
    );
  };

  const onMove = (e: React.PointerEvent) => {
    if (!st.dragging) return;
    const dx = e.clientX - st.sx;
    const dy = e.clientY - st.sy;
    st.dx = dx;
    st.dy = dy;
    const dist = Math.hypot(dx, dy);

    if (dist > 6) {
      cancelAnimationFrame(rafRef.current);
      st.phi = Math.atan2(dy, dx);
    }

    /* Peel progress based on distance dragged; threshold at ~38% of sticker diameter */
    const thresholdPx = item.d * 0.38;
    st.p = Math.min(0.999, 0.22 + (dist / thresholdPx) * 0.68);
    const cap = item.d * 0.42;
    st.fx = Math.max(-cap, Math.min(cap, dx * 0.32));
    st.fy = Math.max(-cap, Math.min(cap, dy * 0.32));
    render();
    foley.peelUpdate(st.p);

    /* Auto-complete peel as soon as user drags past the 38% threshold */
    if (dist >= thresholdPx) {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      completeFromCurrent();
    }
  };

  const release = (e: React.PointerEvent) => {
    if (!st.dragging) return;
    st.dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

    const dist = Math.hypot(st.dx, st.dy);
    const elapsed = performance.now() - st.downAt;

    /* Quick click/tap or sufficient peel progress -> complete the peel! */
    if (st.p >= 0.72 || (dist < 14 && elapsed < 320)) {
      completeFromCurrent();
      return;
    }

    /* Released before threshold -> springy snap back onto the wall (slight overshoot) */
    const p0 = st.p;
    const fx0 = st.fx;
    const fy0 = st.fy;
    const backOut = (t: number) => {
      const c3 = 1.7;
      const u = t - 1;
      return 1 + (c3 + 1) * u * u * u + c3 * u * u;
    };
    animate(
      380,
      backOut,
      (t) => {
        const a = 1 - t; /* goes slightly negative near the end = overshoot past flat */
        st.p = Math.max(0, p0 * a);
        st.fx = fx0 * a;
        st.fy = fy0 * a;
        foley.peelUpdate(st.p);
      },
      () => {
        st.p = 0;
        st.fx = 0;
        st.fy = 0;
        render();
        foley.snap();
        st.busy = false;
        setActive(false);
        if (wrapRef.current) {
          wrapRef.current.classList.remove("peeling");
          /* Little jelly wobble as the adhesive re-grips */
          wrapRef.current.classList.add("snapped");
          window.setTimeout(() => wrapRef.current?.classList.remove("snapped"), 380);
        }
        onAbort();
      },
    );
  };

  /* When removed: return null so the underlying advertisement background is 100% revealed with no second label! */
  if (removed) return null;

  const face = (
    <div className="sticker-face" style={{ background: pal.bg, color: pal.fg, ["--rot" as string]: `${item.rot}deg` }}>
      <div className="sticker-grain" />
      <div className="sticker-ring" />
      <div className="sticker-ring inner" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3%] px-[7%] text-center">
        <span
          className="font-sans font-bold uppercase"
          style={{ fontSize: Math.round(item.d * 0.082), letterSpacing: "0.18em", opacity: 0.88 }}
        >
          Peel
        </span>
        <span
          className="font-display uppercase"
          style={{ fontSize: Math.round(tSize), lineHeight: 0.88, letterSpacing: "-0.02em" }}
        >
          {words.map((w, i) => (
            <span key={i} className="block">
              {w}
            </span>
          ))}
        </span>
        <span
          className="font-mono uppercase"
          style={{ fontSize: Math.round(item.d * 0.072), letterSpacing: "0.12em", opacity: 0.78 }}
        >
          {item.kind === 1 ? "★ PEEL" : "PEEL ↑"}
        </span>
      </div>
      <div className="sticker-gloss" />
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`peel-wrap${active ? " peeling" : ""}`}
      style={{
        left: item.x - r,
        top: item.y - r,
        width: item.d,
        height: item.d,
        zIndex: active || hover ? 900 : 10 + ((item.id * 37) % 15),
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          autoPeel();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Peel sticker ${item.id + 1}: ${item.teaser}`}
    >
      {/* 1. Still-stuck portion of the sticker */}
      <div ref={stuckRef} className="peel-stuck">
        {face}
      </div>

      {/* 2. Soft shadow cast by the curled flap onto the stuck sticker */}
      <div ref={creaseRef} className="peel-crease" style={{ opacity: 0 }} />

      {/* 3. Curled flap (clean adhesive backside folded across the peel line) */}
      <div ref={flapRef} className="peel-flap" style={{ opacity: 0 }}>
        <div className="sticker-back">
          <div ref={shadeRef} className="peel-shade" />
        </div>
      </div>
    </div>
  );
}
