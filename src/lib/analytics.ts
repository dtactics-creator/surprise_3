import { supabase } from "./supabase";

export type AnalyticsEventType =
  | "rub_started"
  | "rub_abandoned"
  | "energy_milestone"
  | "reveal_shown"
  | "cta_click"
  | "coupon_copy"
  | "share";

export type AnalyticsPayload = {
  event_type: AnalyticsEventType;
  reveal_type?: string | null;
  reveal_title?: string | null;
  brand?: string | null;
  milestone?: number | null;
};

const SESSION_KEY = "magic_lamp_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/** Fire-and-forget analytics logging. Never throws or blocks the UI. */
export function trackEvent(payload: AnalyticsPayload): void {
  const row = {
    event_type: payload.event_type,
    reveal_type: payload.reveal_type ?? null,
    reveal_title: payload.reveal_title ?? null,
    brand: payload.brand ?? null,
    milestone: payload.milestone ?? null,
    session_id: getSessionId(),
  };
  void supabase
    .from("analytics_events")
    .insert(row)
    .then(({ error }) => {
      if (error) console.warn("analytics insert failed", error.message);
    });
}
