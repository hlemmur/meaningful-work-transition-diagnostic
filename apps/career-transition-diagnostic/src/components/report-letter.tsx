type ReportSection = {
  id: string;
  title: string;
  body: string;
};

type ReportLetterProps = {
  sections: ReportSection[];
};

export function ReportLetter({ sections }: ReportLetterProps) {
  return (
    <article className="report-page flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Private report</h1>
      <p className="font-display text-xl leading-8 text-muted">A letter for you.</p>
      <p className="leading-7">Dear you,</p>
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-medium">{section.title}</h2>
          <p className="leading-7">{section.body}</p>
        </section>
      ))}
      <p className="leading-7">With care, Lena</p>
      <p className="print:hidden leading-7 text-muted" data-coaching-cta="true">
        If you want to continue this inquiry 1:1,{" "}
        <a className="underline" href="mailto:contact@radicalcreationcoaching.com">
          ask Lena about coaching
        </a>
        .
      </p>
      <p className="print:hidden text-sm text-muted">Print this page if you want a PDF.</p>
    </article>
  );
}
