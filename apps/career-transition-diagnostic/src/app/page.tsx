import { JournalShell } from "@/components/journal-shell";
import { LandingCover } from "@/components/landing-cover";
import { isMockMode } from "@/config/app-mode";
import { paymentsEnabled } from "@/config/launch-gate";

export const dynamic = "force-dynamic";

export default function Home() {
  const mock = isMockMode();
  const liveCheckoutUrl = process.env.LEMON_SQUEEZY_CHECKOUT_URL;
  const canSell = !mock && paymentsEnabled() && Boolean(liveCheckoutUrl);

  return (
    <JournalShell>
      <LandingCover mock={mock} canSell={canSell} liveCheckoutUrl={liveCheckoutUrl} />
    </JournalShell>
  );
}
