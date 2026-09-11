import { JournalShell } from "@/components/journal-shell";
import { isMockMode } from "@/config/app-mode";
import { paymentsEnabled } from "@/config/launch-gate";

export const dynamic = "force-dynamic";

export default function Home() {
  const mock = isMockMode();
  const liveCheckoutUrl = process.env.LEMON_SQUEEZY_CHECKOUT_URL;
  const canSell = !mock && paymentsEnabled() && Boolean(liveCheckoutUrl);

  return (
    <JournalShell>
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Meaningful Work Transition Diagnostic
        </h1>
        <p className="text-lg leading-8 text-muted">
          A self-paced assessment for people who already know what they want and
          still cannot move. After purchase you receive a private link. Lena
          reviews every report before it is delivered.
        </p>
        {mock ? (
          <a
            className="inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
            href="/mock/checkout"
          >
            Continue in mock checkout
          </a>
        ) : canSell ? (
          <a
            className="inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
            href={liveCheckoutUrl}
          >
            Purchase the diagnostic
          </a>
        ) : (
          <p className="leading-7 text-muted">
            Paid checkout is not enabled until the launch gate is green.
          </p>
        )}
      </main>
    </JournalShell>
  );
}
