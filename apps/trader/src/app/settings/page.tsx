import ProfileSettings from "@/components/ProfileSettings";
import TraderShell from "@/components/TraderShell";

export default function SettingsPage() {
  return (
    <TraderShell title="Settings" subtitle="Profile, ORA preferences, and workspace controls.">
      <ProfileSettings />
    </TraderShell>
  );
}
