import type { Metadata } from "next";

import { DeleteAccountForm } from "./delete-account-form";
import { MeSettingsForm } from "./me-settings-form";
import { PasswordSettingsForm } from "./password-settings-form";
import { PageHeader } from "@/components/ui/page";
import { SettingsNav } from "@/components/settings-nav";
import { getViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Your settings" };

export default async function MeSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <>
      <PageHeader
        eyebrow="Make yourself at home"
        title="Your settings"
        description="Your profile, your preferences, your pace."
      />
      <SettingsNav current="me" />

      <div className="settings-content settings-stack">
        <MeSettingsForm profile={viewer.profile} />
        <PasswordSettingsForm />
        <DeleteAccountForm isHead={viewer.profile.role === "head"} onTeam={Boolean(viewer.profile.team_id)} />
      </div>
    </>
  );
}
