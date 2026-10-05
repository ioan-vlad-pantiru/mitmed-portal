import { getSiteAnnouncement } from "@/actions/site";
import { AnnouncementForm } from "./AnnouncementForm";

export default async function SiteSettingsPage() {
  const announcement = await getSiteAnnouncement();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Site de prezentare</h1>
        <p className="text-sm text-zinc-500">
          Bara portocalie din partea de sus a mitmed.ro — schimbă textul sau ascunde-o complet.
        </p>
      </div>
      <AnnouncementForm announcement={announcement} />
    </div>
  );
}
