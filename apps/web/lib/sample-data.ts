// DEMONSTRATION DATA ONLY — replace with live API responses in Phase 9.
// No real customers, addresses, or content. Safe to show in the UI while the
// backend wiring lands.
import type { Status } from "@/components/ui/badge";

export interface Sandbox {
  id: string;
  name: string;
  subdomain: string;
  connected: boolean;
}

export interface Message {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  preview: string;
  ageSeconds: number;
  sizeBytes: number;
  parts: number;
  unread: boolean;
  status: Status;
  tags: string[];
}

export const SANDBOXES: Sandbox[] = [
  { id: "sbx_a1", name: "checkout-staging", subdomain: "checkout-staging", connected: true },
  { id: "sbx_b2", name: "auth-qa", subdomain: "auth-qa", connected: true },
  { id: "sbx_c3", name: "billing-dev", subdomain: "billing-dev", connected: false },
];

export const MESSAGES: Message[] = [
  {
    id: "m_01",
    from: "no-reply@app.test",
    fromName: "Checkout",
    to: "buyer@example.test",
    subject: "Your order #4821 is confirmed",
    preview: "Thanks for your purchase. Your receipt and shipping details are below.",
    ageSeconds: 4,
    sizeBytes: 48213,
    parts: 3,
    unread: true,
    status: "ok",
    tags: ["receipt"],
  },
  {
    id: "m_02",
    from: "security@app.test",
    fromName: "Security",
    to: "buyer@example.test",
    subject: "Reset your password",
    preview: "We received a request to reset the password for your account.",
    ageSeconds: 51,
    sizeBytes: 12980,
    parts: 2,
    unread: true,
    status: "ok",
    tags: ["password-reset"],
  },
  {
    id: "m_03",
    from: "billing@app.test",
    fromName: "Billing",
    to: "buyer@example.test",
    subject: "Payment failed for invoice INV-2210",
    preview: "Your most recent payment could not be processed. Please update your card.",
    ageSeconds: 372,
    sizeBytes: 9120,
    parts: 1,
    unread: false,
    status: "warn",
    tags: ["billing"],
  },
  {
    id: "m_04",
    from: "digest@app.test",
    fromName: "Weekly Digest",
    to: "buyer@example.test",
    subject: "Your weekly summary",
    preview: "Here is what happened in your workspace this week.",
    ageSeconds: 3600,
    sizeBytes: 184320,
    parts: 4,
    unread: false,
    status: "ok",
    tags: [],
  },
  {
    id: "m_05",
    from: "no-reply@app.test",
    fromName: "Notifications",
    to: "invalid@@example",
    subject: "Bounced: could not deliver notification",
    preview: "The recipient address was rejected by the capture validator.",
    ageSeconds: 7420,
    sizeBytes: 5310,
    parts: 1,
    unread: false,
    status: "error",
    tags: ["bounced"],
  },
];

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
