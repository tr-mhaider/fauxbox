import { AppShell } from "@/components/shell/app-shell";
import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  return (
    <AppShell active="settings" title="Settings">
      <SettingsClient />
    </AppShell>
  );
}
