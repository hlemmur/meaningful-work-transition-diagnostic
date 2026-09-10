export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-20">
      <p className="text-sm uppercase tracking-[0.2em] text-[#b65f3e]">
        Radical Creation Coaching
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        Meaningful Work Transition Diagnostic
      </h1>
      <p className="text-lg leading-8 text-[#4a3b34]">
        A self-paced assessment for people who already know what they want and
        still cannot move. After purchase you receive a private link. Lena
        reviews every report before it is delivered.
      </p>
      <a
        className="inline-flex w-fit rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
        href="/mock/checkout"
      >
        Continue in mock checkout
      </a>
    </main>
  );
}
