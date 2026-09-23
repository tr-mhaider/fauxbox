"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Bell, Clock, Info } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatSize } from "@/lib/view-model";
import {
  notificationsEnabled,
  setNotificationsEnabled,
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import type { AppInfo } from "@/lib/types";
import { cn } from "@/lib/cn";

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-muted">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

export function SettingsClient() {
  const { mode, setMode } = useTheme();
  const { notify } = useToast();

  const [notifOn, setNotifOn] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const [info, setInfo] = useState<AppInfo | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    setNotifOn(notificationsEnabled());
    setPerm(notificationPermission());
    const ctrl = new AbortController();
    api
      .getAppInfo(ctrl.signal)
      .then(setInfo)
      .catch(() => {
        // about section just shows nothing if info is unavailable
      });
    return () => ctrl.abort();
  }, []);

  async function toggleNotifications() {
    if (notifOn) {
      setNotificationsEnabled(false);
      setNotifOn(false);
      return;
    }
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === "granted") {
      setNotificationsEnabled(true);
      setNotifOn(true);
      notify("Browser notifications on", "ok");
    } else if (result === "unsupported") {
      notify("This browser doesn't support notifications", "warn");
    } else {
      notify("Notification permission was not granted", "warn");
    }
  }

  const updateAvailable =
    info && info.LatestVersion && !["disabled", "", info.Version].includes(info.LatestVersion);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-5 md:p-8">
        <Card icon={Sun} title="Appearance" description="How Fauxbox looks on this device.">
          <div className="flex gap-2">
            {THEME_OPTIONS.map((o) => {
              const Icon = o.icon;
              const active = mode === o.mode;
              return (
                <button
                  key={o.mode}
                  type="button"
                  onClick={() => setMode(o.mode)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-xs font-medium transition-colors",
                    active
                      ? "border-accent bg-accent-weak text-accent"
                      : "border-border-strong text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {o.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card icon={Bell} title="Notifications" description="Desktop alerts when new mail is captured.">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-fg">Browser notifications</p>
              <p className="text-xs text-muted">
                {perm === "denied"
                  ? "Blocked in your browser settings — allow notifications for this site to enable."
                  : perm === "unsupported"
                    ? "Not supported in this browser."
                    : "Shows a desktop notification for each captured message."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifOn}
              disabled={perm === "denied" || perm === "unsupported"}
              onClick={toggleNotifications}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
                notifOn ? "bg-accent" : "bg-border-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-transform",
                  notifOn ? "translate-x-[1.375rem]" : "translate-x-0.5",
                )}
                aria-hidden
              />
            </button>
          </div>
        </Card>

        <Card icon={Clock} title="Timezone" description="Used to interpret date filters in search.">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-sm text-fg">{timezone}</span>
            <span className="text-xs text-faint">detected</span>
          </div>
        </Card>

        <Card icon={Info} title="About" description="Runtime and version information.">
          {!info ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-faint">Version</dt>
                <dd className="flex items-center gap-2 font-mono text-fg">
                  {info.Version}
                  {updateAvailable && <Badge status="warn" mono>update {info.LatestVersion}</Badge>}
                  {!updateAvailable && info.LatestVersion === info.Version && (
                    <Badge status="ok" mono>latest</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Messages stored</dt>
                <dd className="font-mono text-fg">{info.Messages.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Database size</dt>
                <dd className="font-mono text-fg">{formatSize(info.DatabaseSize)}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Uptime</dt>
                <dd className="font-mono text-fg">{uptime(info.RuntimeStats.Uptime)}</dd>
              </div>
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}
