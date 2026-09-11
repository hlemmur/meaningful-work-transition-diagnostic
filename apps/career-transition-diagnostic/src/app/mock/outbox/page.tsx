import { notFound } from "next/navigation";
import { isMockMode } from "@/config/app-mode";
import { createVendorAdapters } from "@/server/adapters";

export const dynamic = "force-dynamic";

function pathLinks(text: string) {
  return text.match(/\/(?:a|r)\/[a-f0-9]+/g) ?? [];
}

export default function MockOutboxPage() {
  if (!isMockMode()) {
    notFound();
  }

  const emails = createVendorAdapters().email.listOutbox();

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Mock email outbox</h1>
      <p className="leading-7 text-[#4a3b34]">
        Transactional messages stay here in mock mode. Live Resend is never
        called.
      </p>
      {emails.length === 0 ? (
        <p>Outbox is empty.</p>
      ) : (
        <ul className="space-y-3">
          {emails.map((email) => {
            const links = pathLinks(email.text);
            return (
              <li key={`${email.subject}-${email.sentAt}-${links[0] ?? email.to}`} className="rounded border border-[#e6d8cc] bg-white p-4">
                <p className="font-medium">{email.subject}</p>
                <p className="text-sm text-[#4a3b34]">{email.to}</p>
                <p className="mt-2 text-sm">{email.text}</p>
                {links.map((href) => (
                  <a
                    key={href}
                    className="mt-2 inline-flex text-sm font-medium underline"
                    href={href}
                  >
                    {href.startsWith("/r/") ? "Open report" : "Open assessment"}
                  </a>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
