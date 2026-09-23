import { AppShell } from "@/components/shell/app-shell";
import { AccountClient } from "./account-client";

export default function AccountPage() {
  return (
    <AppShell active="account" title="Account">
      <AccountClient />
    </AppShell>
  );
}
