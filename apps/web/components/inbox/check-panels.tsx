"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type { HTMLCheckResponse, LinkCheckResponse, SpamResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// Runs a check once when the panel mounts (i.e. when its tab is opened), so the
// expensive checks (link check makes HTTP requests, spam calls SpamAssassin)
// only fire on demand. Switching away and back re-runs it.
function useCheck<T>(fn: (signal: AbortSignal) => Promise<T>, dep: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setData(null);
    setError(null);
    fn(ctrl.signal)
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        if (cancelled || e?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Check failed");
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return { data, error, loading: !data && !error };
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

// Stacked support bar: supported / partial / unsupported.
function SupportBar({ s, p, u }: { s: number; p: number; u: number }) {
  return (
    <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <span className="h-full bg-ok" style={{ width: `${s}%` }} />
      <span className="h-full bg-warn" style={{ width: `${p}%` }} />
      <span className="h-full bg-error" style={{ width: `${u}%` }} />
    </span>
  );
}

export function HtmlCheckPanel({ sandbox, id }: { sandbox: string; id: string }) {
  const { data, error, loading } = useCheck<HTMLCheckResponse>(
    (signal) => api.htmlCheck(sandbox, id, signal),
    `${sandbox}:${id}`,
  );

  if (loading) return <p className="text-sm text-muted">Running HTML compatibility check…</p>;
  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="text-muted">Overall</span>
          <SupportBar s={data.Total.Supported} p={data.Total.Partial} u={data.Total.Unsupported} />
        </span>
        <span className="text-muted">
          <span className="font-medium text-fg">{pct(data.Total.Supported)}</span> supported ·{" "}
          {pct(data.Total.Partial)} partial · {pct(data.Total.Unsupported)} unsupported
        </span>
        <span className="ml-auto font-mono text-2xs text-faint">
          {data.Total.Tests} tests · {data.Total.Nodes} nodes
        </span>
      </div>

      {data.Warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 className="size-4" aria-hidden /> No compatibility warnings.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {data.Warnings.map((w) => (
            <li key={w.Slug} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <a
                  href={w.URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-fg hover:text-accent"
                >
                  {w.Title}
                  <ExternalLink className="size-3 text-faint" aria-hidden />
                </a>
                <p className="font-mono text-2xs uppercase text-faint">{w.Category}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <SupportBar s={w.Score.Supported} p={w.Score.Partial} u={w.Score.Unsupported} />
                <span className="font-mono text-2xs text-faint">{pct(w.Score.Supported)} supported</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function linkStatus(code: number): "ok" | "warn" | "error" {
  if (code >= 200 && code < 300) return "ok";
  if (code >= 300 && code < 400) return "warn";
  return "error";
}

export function LinkCheckPanel({ sandbox, id }: { sandbox: string; id: string }) {
  const { data, error, loading } = useCheck<LinkCheckResponse>(
    (signal) => api.linkCheck(sandbox, id, signal),
    `${sandbox}:${id}`,
  );

  if (loading) return <p className="text-sm text-muted">Checking links…</p>;
  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Badge status={data.Errors > 0 ? "error" : "ok"} dot>
          {data.Errors} error{data.Errors === 1 ? "" : "s"}
        </Badge>
        <span className="text-muted">
          {data.Links.length} link{data.Links.length === 1 ? "" : "s"} checked
        </span>
      </div>

      {data.Links.length === 0 ? (
        <p className="text-sm text-muted">No links found in this message.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {data.Links.map((l, i) => {
            const status = linkStatus(l.StatusCode);
            return (
              <li key={`${l.URL}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2">
                <a
                  href={l.URL}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate font-mono text-xs text-muted hover:text-accent"
                >
                  {l.URL}
                </a>
                <span
                  className={cn(
                    "shrink-0 font-mono text-2xs tabular",
                    status === "ok" ? "text-ok" : status === "warn" ? "text-warn" : "text-error",
                  )}
                >
                  {l.StatusCode || "—"} {l.Status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SpamCheckPanel({ sandbox, id }: { sandbox: string; id: string }) {
  const { data, error, loading } = useCheck<SpamResult>(
    (signal) => api.spamCheck(sandbox, id, signal),
    `${sandbox}:${id}`,
  );

  if (loading) return <p className="text-sm text-muted">Running SpamAssassin…</p>;
  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data) return null;
  if (data.Error) return <p className="text-sm text-error">{data.Error}</p>;

  const rules = data.Rules ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <Badge status={data.IsSpam ? "error" : "ok"} dot>
          {data.IsSpam ? "Spam" : "Clean"}
        </Badge>
        <span className="text-sm text-muted">
          Score <span className="font-mono font-medium text-fg">{data.Score.toFixed(1)}</span>{" "}
          <span className="text-faint">(spam ≥ 5.0)</span>
        </span>
        {!data.IsSpam && <CheckCircle2 className="ml-auto size-4 text-ok" aria-hidden />}
        {data.IsSpam && <AlertTriangle className="ml-auto size-4 text-error" aria-hidden />}
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-muted">No rules triggered.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {rules.map((r) => (
            <li key={r.Name} className="flex items-start justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium text-fg">{r.Name}</p>
                <p className="text-xs text-muted">{r.Description}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-2xs tabular",
                  r.Score > 0 ? "text-error" : "text-ok",
                )}
              >
                {r.Score > 0 ? "+" : ""}
                {r.Score.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
