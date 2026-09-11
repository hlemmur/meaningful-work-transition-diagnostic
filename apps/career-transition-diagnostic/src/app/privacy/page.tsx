import { JournalShell } from "@/components/journal-shell";
import { MARKETING_CONSENT_COPY, PRODUCT_CONSENT_COPY } from "@/server/consent/copy";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const product = PRODUCT_CONSENT_COPY;
  const marketing = MARKETING_CONSENT_COPY;

  return (
    <JournalShell>
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy for this diagnostic</h1>
        <p>
          <a className="text-sm underline" href="/">
            Back
          </a>
        </p>
        <p className="leading-7 text-muted">
          This notice is specific to the Meaningful Work Transition Diagnostic and does not replace
          Radical Creation Coaching’s general privacy policy.
        </p>
        <section className="flex flex-col gap-3 leading-7 text-muted">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{product.scope.heading}</h2>
          <p>{product.scope.body}</p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {product.aiProcessing.heading}
          </h2>
          <p>{product.aiProcessing.body}</p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {product.coachingNotTherapy.heading}
          </h2>
          <p>{product.coachingNotTherapy.body}</p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">{product.privacy.heading}</h2>
          <p>{product.privacy.retention}</p>
          <p>{product.privacy.deletion}</p>
          <p>{product.privacy.analytics}</p>
        </section>
        <section className="flex flex-col gap-3 leading-7 text-muted">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Optional marketing</h2>
          <p>{marketing.checkboxLabel}</p>
          <p>{marketing.withdrawal}</p>
        </section>
      </main>
    </JournalShell>
  );
}
