import Link from "next/link";
import { JournalShell } from "@/components/journal-shell";
import { MARKETING_CONSENT_COPY, PRODUCT_CONSENT_COPY } from "@/server/consent/copy";

type WelcomeConsentFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function WelcomeConsentForm({ action }: WelcomeConsentFormProps) {
  const product = PRODUCT_CONSENT_COPY;
  const marketing = MARKETING_CONSENT_COPY;

  return (
    <JournalShell>
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{product.title}</h1>
        <p className="leading-7 text-muted">{product.intro}</p>

        <section className="flex flex-col gap-3 text-muted" data-copy-version={product.version}>
          <h2 className="text-lg font-semibold tracking-tight text-ink">{product.scope.heading}</h2>
          <p className="leading-7">{product.scope.body}</p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {product.aiProcessing.heading}
          </h2>
          <p className="leading-7">{product.aiProcessing.body}</p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {product.coachingNotTherapy.heading}
          </h2>
          <p className="leading-7">{product.coachingNotTherapy.body}</p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">{product.privacy.heading}</h2>
          <p className="leading-7">{product.privacy.retention}</p>
          <p className="leading-7">{product.privacy.deletion}</p>
          <p className="leading-7">{product.privacy.analytics}</p>
          <p className="text-sm">
            Copy version {product.version}. Full notice:{" "}
            <Link className="underline" href="/privacy">
              Privacy for this diagnostic
            </Link>
            .
          </p>
        </section>

        <form className="flex flex-col gap-4" action={action}>
          <label className="flex items-start gap-3">
            <input id="product-consent" name="productConsent" type="checkbox" required />
            <span>{product.checkboxLabel}</span>
          </label>
          <label className="flex items-start gap-3">
            <input id="marketing-opt-in" name="marketingOptIn" type="checkbox" />
            <span>
              {marketing.checkboxLabel} {marketing.withdrawal}
            </span>
          </label>
          <p className="text-sm text-muted" data-copy-version={marketing.version}>
            Marketing copy version {marketing.version}.
          </p>
          <button
            className="w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
            type="submit"
          >
            Continue to assessment
          </button>
        </form>
      </main>
    </JournalShell>
  );
}
