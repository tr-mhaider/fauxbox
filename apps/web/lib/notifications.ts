"use client";

// Browser notification preference + firing. The preference is a per-viewer
// convenience, so it lives in localStorage; a notification only shows when the
// user opted in AND the browser granted permission.
const KEY = "fauxbox-notify";

export function notificationsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // storage unavailable; the toggle just won't persist
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export function showNewMail(title: string, body: string) {
  if (!notificationsEnabled()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/notification.png" });
  } catch {
    // some browsers require a ServiceWorker for notifications; ignore failures
  }
}
