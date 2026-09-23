// Credentialed client for the Go API. Requests are same-origin (the Next dev
// server proxies /api/* to the Go server; in prod the Go server serves this
// app), so the SameSite=Lax auth cookies flow automatically. Mutations carry
// the double-submit CSRF token; per-sandbox reads carry X-Sandbox-ID.
import type {
  LoginResult,
  MessagesResult,
  Message,
  Sandbox,
  WebUIConfig,
  HTMLCheckResponse,
  LinkCheckResponse,
  SpamResult,
  AccountUser,
  APIToken,
  AppInfo,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

interface Opts {
  method?: string;
  sandbox?: string; // sets X-Sandbox-ID for per-sandbox reads
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: Opts = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};

  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.sandbox) headers["X-Sandbox-ID"] = opts.sandbox;
  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCookie("fauxbox_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "include",
    signal: opts.signal,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      if (data?.Error) msg = data.Error;
    } catch {
      // non-JSON error body; keep the status text
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResult>("/v1/auth/login", { method: "POST", body: { email, password } }),

  logout: () => request<void>("/v1/auth/logout", { method: "POST" }),

  listSandboxes: () => request<Sandbox[]>("/v1/sandboxes"),

  getMessages: (sandbox: string, start = 0, limit = 50, signal?: AbortSignal) =>
    request<MessagesResult>(`/v1/messages?start=${start}&limit=${limit}`, { sandbox, signal }),

  getMessage: (sandbox: string, id: string, signal?: AbortSignal) =>
    request<Message>(`/v1/message/${id}`, { sandbox, signal }),

  search: (sandbox: string, query: string, start = 0, limit = 50, signal?: AbortSignal) =>
    request<MessagesResult>(
      `/v1/search?query=${encodeURIComponent(query)}&start=${start}&limit=${limit}`,
      { sandbox, signal },
    ),

  setRead: (sandbox: string, ids: string[], read: boolean) =>
    request<void>("/v1/messages", { method: "PUT", sandbox, body: { Read: read, IDs: ids } }),

  deleteMessages: (sandbox: string, ids: string[]) =>
    request<void>("/v1/messages", { method: "DELETE", sandbox, body: { IDs: ids } }),

  // Overwrites a single message's tags (the API replaces, not appends), so the
  // caller passes the full desired set.
  setMessageTags: (sandbox: string, id: string, tags: string[]) =>
    request<void>("/v1/tags", { method: "PUT", sandbox, body: { IDs: [id], Tags: tags } }),

  getTags: (sandbox: string, signal?: AbortSignal) =>
    request<string[]>("/v1/tags", { sandbox, signal }),

  // Global web UI config (release enablement, recipient rules); not sandbox-scoped.
  getWebUIConfig: (signal?: AbortSignal) => request<WebUIConfig>("/v1/webui", { signal }),

  releaseMessage: (sandbox: string, id: string, to: string[]) =>
    request<void>(`/v1/message/${id}/release`, { method: "POST", sandbox, body: { To: to } }),

  htmlCheck: (sandbox: string, id: string, signal?: AbortSignal) =>
    request<HTMLCheckResponse>(`/v1/message/${id}/html-check`, { sandbox, signal }),

  linkCheck: (sandbox: string, id: string, signal?: AbortSignal) =>
    request<LinkCheckResponse>(`/v1/message/${id}/link-check`, { sandbox, signal }),

  spamCheck: (sandbox: string, id: string, signal?: AbortSignal) =>
    request<SpamResult>(`/v1/message/${id}/sa-check`, { sandbox, signal }),

  listUsers: (signal?: AbortSignal) => request<AccountUser[]>("/v1/account/users", { signal }),

  createUser: (email: string, password: string, role: string) =>
    request<{ id: string }>("/v1/account/users", {
      method: "POST",
      body: { email, password, role },
    }),

  listTokens: (signal?: AbortSignal) => request<APIToken[]>("/v1/account/tokens", { signal }),

  createToken: (scopes: string) =>
    request<{ id: string; token: string }>("/v1/account/tokens", {
      method: "POST",
      body: { scopes },
    }),

  deleteToken: (id: string) =>
    request<void>(`/v1/account/tokens/${id}`, { method: "DELETE" }),

  getAppInfo: (signal?: AbortSignal) => request<AppInfo>("/v1/info", { signal }),

  // Attachment / inline part (or its thumbnail) as a Blob. The part endpoints
  // require the X-Sandbox-ID header, so a plain <img>/<a> can't reach them —
  // callers turn the Blob into an object URL.
  fetchPart: async (
    sandbox: string,
    id: string,
    partID: string,
    thumb = false,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    const res = await fetch(`/api/v1/message/${id}/part/${partID}${thumb ? "/thumb" : ""}`, {
      headers: { "X-Sandbox-ID": sandbox },
      credentials: "include",
      signal,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },
};
