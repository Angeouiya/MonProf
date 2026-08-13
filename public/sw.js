/* Compétence Web Push worker */
self.addEventListener("push", (event) => {
  const fallback = {
    title: "Compétence",
    body: "Une nouvelle information est disponible.",
    icon: "/images/brand/competence-icon-512-safe.png",
    badge: "/images/brand/competence-icon-192-safe.png",
    url: "/",
    tag: "competence-notification",
  };
  let data = fallback;
  try {
    data = { ...fallback, ...(event.data ? event.data.json() : {}) };
  } catch {
    data = { ...fallback, body: event.data ? event.data.text() : fallback.body };
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: "COMPETENCE_PUSH_RECEIVED", payload: data }));
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: { url: data.url },
      renotify: true,
      silent: data.silent === true,
      requireInteraction: data.priority === "CRITICAL",
      vibrate: data.priority === "CRITICAL" || data.priority === "URGENT" ? [180, 80, 180] : [120],
    });
    const badgeCount = Number(data.badgeCount);
    if (Number.isFinite(badgeCount) && badgeCount >= 0 && self.navigator && "setAppBadge" in self.navigator) {
      try {
        if (badgeCount > 0) await self.navigator.setAppBadge(badgeCount);
        else if ("clearAppBadge" in self.navigator) await self.navigator.clearAppBadge();
      } catch {}
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let destination = new URL("/", self.location.origin);
    try {
      const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
      if (candidate.origin === self.location.origin) destination = candidate;
    } catch {}

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(destination.href);
        return;
      }
    }
    await self.clients.openWindow(destination.href);
  })());
});
