"use client";

import { useEffect, useState } from "react";
import { Users, KeyRound, Boxes, Plus, Copy, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatSize } from "@/lib/view-model";
import type { AccountUser, APIToken } from "@/lib/types";

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Users;
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

const selectClass =
  "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg focus-visible:border-accent";

export function AccountClient() {
  const { sandboxes } = useSession();
  const { notify } = useToast();

  const [users, setUsers] = useState<AccountUser[] | null>(null);
  const [tokens, setTokens] = useState<APIToken[] | null>(null);

  const [invite, setInvite] = useState({ email: "", password: "", role: "member" });
  const [inviting, setInviting] = useState(false);

  const [scopes, setScopes] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadUsers() {
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }
  function loadTokens() {
    api.listTokens().then(setTokens).catch(() => setTokens([]));
  }
  useEffect(() => {
    loadUsers();
    loadTokens();
  }, []);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await api.createUser(invite.email.trim(), invite.password, invite.role);
      notify(`Invited ${invite.email.trim()}`, "ok");
      setInvite({ email: "", password: "", role: "member" });
      loadUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Invite failed", "error");
    } finally {
      setInviting(false);
    }
  }

  async function submitToken(e: React.FormEvent) {
    e.preventDefault();
    setCreatingToken(true);
    try {
      const res = await api.createToken(scopes.trim());
      setNewToken(res.token);
      setScopes("");
      loadTokens();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not create token", "error");
    } finally {
      setCreatingToken(false);
    }
  }

  async function revoke() {
    if (!revokeId) return;
    setBusy(true);
    try {
      await api.deleteToken(revokeId);
      notify("Token revoked", "ok");
      setRevokeId(null);
      loadTokens();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Revoke failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function copyToken() {
    if (newToken) {
      navigator.clipboard?.writeText(newToken).then(
        () => notify("Token copied", "ok"),
        () => notify("Copy failed", "error"),
      );
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-5 md:p-8">
        {/* Team */}
        <Card icon={Users} title="Team" description="People with access to this account.">
          {users === null ? (
            <p className="text-sm text-muted">Loading team…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-faint">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-2 text-muted">
                      No users yet.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-xs text-fg">{u.email}</td>
                    <td className="py-2 capitalize text-muted">{u.role || "member"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={submitInvite} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <Field label="Email" htmlFor="inv-email">
              <Input
                id="inv-email"
                type="email"
                required
                value={invite.email}
                onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
                placeholder="teammate@company.com"
              />
            </Field>
            <Field label="Temp password" htmlFor="inv-pass">
              <Input
                id="inv-pass"
                type="password"
                required
                value={invite.password}
                onChange={(e) => setInvite((v) => ({ ...v, password: e.target.value }))}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Role" htmlFor="inv-role">
              <select
                id="inv-role"
                className={selectClass}
                value={invite.role}
                onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value }))}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Button type="submit" size="md" loading={inviting}>
              <Plus className="size-4" aria-hidden /> Invite
            </Button>
          </form>
        </Card>

        {/* API tokens */}
        <Card icon={KeyRound} title="API tokens" description="Programmatic access to this account's API.">
          {newToken && (
            <div className="mb-4 rounded-md border border-accent/40 bg-accent-weak p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <ShieldCheck className="size-3.5" aria-hidden /> Copy this token now — it won't be shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-xs text-fg">
                  {newToken}
                </code>
                <Button variant="secondary" size="sm" onClick={copyToken}>
                  <Copy className="size-3.5" aria-hidden /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setNewToken(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {tokens === null ? (
            <p className="text-sm text-muted">Loading tokens…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-faint">
                  <th className="pb-2 font-medium">Token ID</th>
                  <th className="pb-2 font-medium">Scopes</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-muted">
                      No tokens yet.
                    </td>
                  </tr>
                )}
                {tokens.map((t) => (
                  <tr key={t.ID} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-xs text-fg">{t.ID}</td>
                    <td className="py-2 font-mono text-xs text-muted">{t.Scopes || "—"}</td>
                    <td className="py-2 text-xs text-muted">
                      {new Date(t.Created).toLocaleString("en-US")}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeId(t.ID)}
                        aria-label={`Revoke token ${t.ID}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={submitToken} className="mt-4 flex items-end gap-3 border-t border-border pt-4">
            <div className="flex-1">
              <Field label="Scopes (optional)" htmlFor="tok-scopes" hint="Space-separated, e.g. messages:read">
                <Input
                  id="tok-scopes"
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  placeholder="messages:read tags:write"
                  mono
                />
              </Field>
            </div>
            <Button type="submit" size="md" loading={creatingToken}>
              <Plus className="size-4" aria-hidden /> Create token
            </Button>
          </form>
        </Card>

        {/* Sandboxes (read-only) */}
        <Card icon={Boxes} title="Sandboxes" description="Per-sandbox limits and credentials. Limits are set by your plan.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-faint">
                  <th className="pb-2 font-medium">Subdomain</th>
                  <th className="pb-2 font-medium">SMTP user</th>
                  <th className="pb-2 font-medium">Max msgs</th>
                  <th className="pb-2 font-medium">Max size</th>
                  <th className="pb-2 font-medium">Retention</th>
                  <th className="pb-2 font-medium">Rate/min</th>
                  <th className="pb-2 font-medium">Webhook</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {sandboxes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-2 font-sans text-muted">
                      No sandboxes.
                    </td>
                  </tr>
                )}
                {sandboxes.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2 text-fg">{s.subdomain}</td>
                    <td className="py-2 text-muted">{s.smtp_username || "—"}</td>
                    <td className="py-2 text-muted">{s.max_messages || "∞"}</td>
                    <td className="py-2 text-muted">{s.max_message_size ? formatSize(s.max_message_size) : "∞"}</td>
                    <td className="py-2 text-muted">{s.retention_hours ? `${s.retention_hours}h` : "∞"}</td>
                    <td className="py-2 text-muted">{s.rate_limit || "∞"}</td>
                    <td className="py-2 max-w-[12rem] truncate text-muted" title={s.webhook_url}>
                      {s.webhook_url || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog
        open={revokeId !== null}
        onClose={() => setRevokeId(null)}
        title="Revoke token"
        description="Any integration using this token will stop working immediately. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRevokeId(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={revoke} loading={busy}>
              <Trash2 className="size-3.5" aria-hidden /> Revoke
            </Button>
          </>
        }
      />
    </div>
  );
}
