import { AppShell } from "@/components/shell/app-shell";
import { InboxClient } from "./inbox-client";

export default function InboxPage() {
  return (
    <AppShell active="inbox" title="Inbox">
      <InboxClient />
    </AppShell>
  );
}
