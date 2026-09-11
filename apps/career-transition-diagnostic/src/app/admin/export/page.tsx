import { exportMarketingContacts } from "@/server/consent/marketing";
import { requireAdminPage } from "@/server/admin/guard";

export const dynamic = "force-dynamic";

export default async function MarketingExportPage() {
  await requireAdminPage();
  const contacts = await exportMarketingContacts();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Marketing export</h1>
      <p className="leading-7 text-muted">
        Current opt-ins only. No answers, reports, or safety data.
      </p>
      {contacts.length === 0 ? (
        <p>No current marketing opt-ins.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li key={contact.email} className="rounded border border-hairline bg-field p-3">
              <p>{contact.email}</p>
              <p className="text-sm text-muted">{contact.consentCopyVersion}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
