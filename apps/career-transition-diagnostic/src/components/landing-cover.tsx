type LandingCoverProps = {
  mock: boolean;
  canSell: boolean;
  liveCheckoutUrl?: string;
};

export function LandingCover({ mock, canSell, liveCheckoutUrl }: LandingCoverProps) {
  return (
    <main className="flex flex-col gap-8">
      <p className="text-sm uppercase tracking-[0.22em] text-terracotta">A private diagnostic</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Meaningful Work Transition Diagnostic
      </h1>
      <p className="font-display text-2xl leading-10 text-ink">
        For people who already know what they want and still cannot move.
      </p>
      <div className="flex flex-col gap-5 text-lg leading-8 text-muted">
        <p>
          This is self-paced. You move through many chapters on a private link,
          in your own time, without an account or a public profile.
        </p>
        <p>
          After purchase, the link arrives by email. Lena reviews every draft
          before anything is delivered.
        </p>
        <p>
          The report is a working hypothesis about the stall — not a verdict,
          a diagnosis, or a placement service.
        </p>
      </div>
      {mock ? (
        <a
          className="inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
          href="/mock/checkout"
        >
          Begin the diagnostic
        </a>
      ) : canSell && liveCheckoutUrl ? (
        <a
          className="inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
          href={liveCheckoutUrl}
        >
          Purchase the diagnostic
        </a>
      ) : (
        <p className="leading-7 text-muted">This diagnostic is not open for purchase yet.</p>
      )}
      <a className="w-fit text-sm text-muted underline" href="/privacy">
        Privacy for this diagnostic
      </a>
    </main>
  );
}
