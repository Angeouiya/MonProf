export function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function ensureCurrentPushSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
) {
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !subscriptionUsesPublicKey(subscription, publicKey)) {
    await subscription.unsubscribe().catch(() => false);
    subscription = null;
  }
  return subscription || registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export function buildSubscriptionPayload(subscription: PushSubscription) {
  return {
    ...subscription.toJSON(),
    deviceId: getStableDeviceId(),
    ...detectDeviceCapabilities(),
  };
}

export function getStableDeviceId() {
  const key = "competence_web_push_device_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function detectDeviceCapabilities() {
  const navigatorWithHints = navigator as Navigator & {
    userAgentData?: { platform?: string; brands?: Array<{ brand: string; version: string }> };
    standalone?: boolean;
  };
  const userAgent = navigator.userAgent || "";
  const brands = navigatorWithHints.userAgentData?.brands?.map((item) => item.brand).join(", ") || "";
  const pwaInstalled = window.matchMedia?.("(display-mode: standalone)").matches || navigatorWithHints.standalone === true;

  return {
    platform: normalizeMeta(navigatorWithHints.userAgentData?.platform || detectPlatform(userAgent)),
    browser: normalizeMeta(brands || detectBrowser(userAgent)),
    os: normalizeMeta(detectOs(userAgent)),
    pwaInstalled,
    supportsVibration: "vibrate" in navigator,
    supportsBadging: "setAppBadge" in navigator || "clearAppBadge" in navigator,
  };
}

function detectPlatform(userAgent: string) {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "macOS";
  return "Web";
}

function detectOs(userAgent: string) {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows nt/i.test(userAgent)) return "Windows";
  if (/mac os x/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Navigateur web";
}

function detectBrowser(userAgent: string) {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/safari/i.test(userAgent)) return "Safari";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  return "Navigateur";
}

function normalizeMeta(value: string) {
  return value.trim().slice(0, 80);
}

function subscriptionUsesPublicKey(subscription: PushSubscription, publicKey: string) {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return false;
  const current = new Uint8Array(currentKey);
  const expected = urlBase64ToUint8Array(publicKey);
  if (current.byteLength !== expected.byteLength) return false;
  return current.every((byte, index) => byte === expected[index]);
}
