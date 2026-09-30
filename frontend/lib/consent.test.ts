import { describe, expect, it, vi } from "vitest";
import { CONSENT_KEY, createConsentStore } from "@/lib/consent";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

describe("consent store", () => {
  it("pre-consent: no choice has been made, so nothing may run", () => {
    const store = createConsentStore(() => memoryStorage());
    expect(store.read()).toBeNull();
  });

  it("accepted: recorded as granted and persisted", () => {
    const storage = memoryStorage();
    const store = createConsentStore(() => storage);
    store.accept();
    expect(store.read()).toBe("granted");
    expect(storage.data[CONSENT_KEY]).toBe("granted");
  });

  it("rejected: recorded as denied and persisted", () => {
    const storage = memoryStorage();
    const store = createConsentStore(() => storage);
    store.reject();
    expect(store.read()).toBe("denied");
    expect(storage.data[CONSENT_KEY]).toBe("denied");
  });

  it("persisted: a fresh page load (new store, same storage) restores the choice, so the banner does not reappear", () => {
    const storage = memoryStorage();
    createConsentStore(() => storage).accept();
    expect(createConsentStore(() => storage).read()).toBe("granted");

    const storage2 = memoryStorage();
    createConsentStore(() => storage2).reject();
    expect(createConsentStore(() => storage2).read()).toBe("denied");
  });

  it("withdrawal: clearing returns to no-choice and removes the stored value", () => {
    const storage = memoryStorage();
    const store = createConsentStore(() => storage);
    store.accept();
    store.clear();
    expect(store.read()).toBeNull();
    expect(CONSENT_KEY in storage.data).toBe(false);
  });

  it("anything other than an explicit granted/denied is treated as no consent", () => {
    for (const junk of ["true", "yes", "1", "GRANTED", ""]) {
      const store = createConsentStore(() => memoryStorage({ [CONSENT_KEY]: junk }));
      expect(store.read()).toBeNull();
    }
  });

  it("notifies subscribers on every change and stops after unsubscribe", () => {
    const store = createConsentStore(() => memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.accept();
    store.reject();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    store.accept();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("blocked or throwing storage never crashes, and the choice still holds for the session", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createConsentStore(() => broken);
    expect(store.read()).toBeNull();
    store.accept();
    expect(store.read()).toBe("granted");
    store.clear();
    expect(store.read()).toBeNull();

    const noStorage = createConsentStore(() => null);
    noStorage.reject();
    expect(noStorage.read()).toBe("denied");
  });
});
