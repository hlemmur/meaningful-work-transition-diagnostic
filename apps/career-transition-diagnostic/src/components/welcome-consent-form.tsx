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
        <p className="font-display text-xl leading-9">{product.intro}</p>
        <p className="text-sm leading-6 text-muted">
          The full scope, AI disclosure, coaching-not-therapy disclaimer, and privacy notes live on{" "}
          <Link className="underline" href="/privacy">
            Privacy for this diagnostic
          </Link>
          . Please read them before you continue.
        </p>
        <form className="flex flex-col gap-4" action={action}>
          <label className="flex items-start gap-3">
            <input
              id="product-consent"
              className="consent-check mt-1"
              name="productConsent"
              type="checkbox"
              required
            />
            <span>{product.checkboxLabel}</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              id="marketing-opt-in"
              className="consent-check mt-1"
              name="marketingOptIn"
              type="checkbox"
            />
            <span>
              {marketing.checkboxLabel} {marketing.withdrawal}
            </span>
          </label>
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
