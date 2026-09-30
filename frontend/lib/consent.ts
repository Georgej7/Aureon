// Analytics consent: the single source of truth for whether GA4 may run.
//
// Default is NO consent. The choice ("granted" | "denied") is persisted in
// localStorage -- not a cookie -- so the banner doesn't reappear. Everything
// that could load, configure or send to GA4 checks this first (lib/analytics.ts);
// nothing is queued while consent is absent, so a pre-consent event can never be
// replayed later.

export type Consent = "granted" | "denied";

export const CONSENT_KEY = "aureon_analytics_consent";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createConsentStore(getStorage: () => StorageLike | null) {
  const listeners = new Set<() => void>();
  // Fallback for browsers that block storage (private mode etc.): the choice is
  // still honoured for the current page session, it just can't persist.
  let memory: Consent | null = null;

  const read = (): Consent | null => {
    try {
      const stored = getStorage()?.getItem(CONSENT_KEY);
      if (stored === "granted" || stored === "denied") return stored;
    } catch {
      /* storage unavailable: fall through to the in-memory value */
    }
    return memory;
  };

  const notify = () => listeners.forEach((l) => l());

  const write = (value: Consent) => {
    memory = value;
    try {
      getStorage()?.setItem(CONSENT_KEY, value);
    } catch {
      /* not persisted; memory still applies */
    }
    notify();
  };

  const clear = () => {
    memory = null;
    try {
      getStorage()?.removeItem(CONSENT_KEY);
    } catch {
      /* ignore */
    }
    notify();
  };

  // Compatible with React's useSyncExternalStore; also follows changes made in
  // another tab so a withdrawal there takes effect here.
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY || e.key === null) listener();
    };
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("storage", onStorage);
    };
  };

  return {
    read,
    subscribe,
    accept: () => write("granted"),
    reject: () => write("denied"),
    clear,
  };
}

export const consent = createConsentStore(() => (typeof window === "undefined" ? null : window.localStorage));
