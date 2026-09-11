import { exportMarketingContacts } from "@/server/consent/marketing";

export const dynamic = "force-dynamic";

export default function MarketingExportPage() {
  const contacts = exportMarketingContacts();

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Marketing export</h1>
      <p className="leading-7 text-[#4a3b34]">
        Current opt-ins only. No answers, reports, or safety data.
      </p>
      {contacts.length === 0 ? (
        <p>No current marketing opt-ins.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li key={contact.email} className="rounded border border-[#e6d8cc] bg-white p-3">
              <p>{contact.email}</p>
              <p className="text-sm text-[#4a3b34]">{contact.consentCopyVersion}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
