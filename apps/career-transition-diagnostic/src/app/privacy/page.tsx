import { MARKETING_CONSENT_COPY, PRODUCT_CONSENT_COPY } from "@/server/consent/copy";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const product = PRODUCT_CONSENT_COPY;
  const marketing = MARKETING_CONSENT_COPY;

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy for this diagnostic</h1>
      <p className="text-sm text-[#4a3b34]">
        Copy versions {product.version} and {marketing.version}. This notice is specific to the
        Meaningful Work Transition Diagnostic and does not replace Radical Creation Coaching’s
        general privacy policy.
      </p>
      <section className="flex flex-col gap-3 leading-7 text-[#4a3b34]" data-copy-version={product.version}>
        <h2 className="text-lg font-semibold tracking-tight text-[#2b211c]">{product.scope.heading}</h2>
        <p>{product.scope.body}</p>
        <h2 className="text-lg font-semibold tracking-tight text-[#2b211c]">
          {product.aiProcessing.heading}
        </h2>
        <p>{product.aiProcessing.body}</p>
        <h2 className="text-lg font-semibold tracking-tight text-[#2b211c]">
          {product.coachingNotTherapy.heading}
        </h2>
        <p>{product.coachingNotTherapy.body}</p>
        <h2 className="text-lg font-semibold tracking-tight text-[#2b211c]">{product.privacy.heading}</h2>
        <p>{product.privacy.retention}</p>
        <p>{product.privacy.deletion}</p>
        <p>{product.privacy.analytics}</p>
      </section>
      <section className="flex flex-col gap-3 leading-7 text-[#4a3b34]" data-copy-version={marketing.version}>
        <h2 className="text-lg font-semibold tracking-tight text-[#2b211c]">Optional marketing</h2>
        <p>{marketing.checkboxLabel}</p>
        <p>{marketing.withdrawal}</p>
      </section>
    </main>
  );
}
