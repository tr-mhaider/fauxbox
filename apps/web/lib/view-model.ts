import type { Address, MessageSummary } from "./types";

// Normalized list/viewer item derived from the API's MessageSummary. A mail
// capture inbox has no delivery status, so there is none here — every item is a
// captured signal.
export interface MessageItem {
  id: string;
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  preview: string;
  createdISO: string;
  sizeBytes: number;
  attachments: number;
  unread: boolean;
  tags: string[];
}

function addr(a: Address | null | undefined): { name: string; address: string } {
  if (!a) return { name: "", address: "" };
  return { name: a.Name || a.Address, address: a.Address };
}

function joinAddrs(list: Address[] | null | undefined): string {
  if (!list || list.length === 0) return "";
  return list.map((a) => a.Address).join(", ");
}

export function toItem(m: MessageSummary): MessageItem {
  const from = addr(m.From);
  return {
    id: m.ID,
    fromName: from.name || "(unknown sender)",
    fromAddress: from.address,
    to: joinAddrs(m.To) || "(undisclosed)",
    subject: m.Subject || "(no subject)",
    preview: m.Snippet,
    createdISO: m.Created,
    sizeBytes: m.Size,
    attachments: m.Attachments,
    unread: !m.Read,
    tags: m.Tags ?? [],
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAge(createdISO: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(createdISO).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
