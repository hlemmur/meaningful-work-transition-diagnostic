import type { ReactNode } from "react";
import { visibleReportBody } from "./customer-prose";

type ReportSection = {
  id: string;
  title: string;
  body: string;
};

type ReportLetterProps = {
  sections: ReportSection[];
};

const LIST_ITEM = /^\s*(?:([-*])|(\d+)[.)])\s+(.*)$/;

function linesOf(block: string) {
  return block.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
}

function renderBodyBlock(block: string, key: string): ReactNode {
  const lines = linesOf(block);
  if (lines.length === 0) return null;

  const parsed = lines.map((line) => line.match(LIST_ITEM));
  if (parsed.every(Boolean)) {
    const allBullets = parsed.every((match) => match?.[1]);
    const allNumbered = parsed.every((match) => match?.[2]);
    const items = parsed.map((match, index) => (
      <li key={`${key}-${index}`}>{match?.[3] ?? ""}</li>
    ));
    if (allBullets) {
      return (
        <ul key={key} className="list-disc space-y-1 pl-5 leading-7">
          {items}
        </ul>
      );
    }
    if (allNumbered) {
      return (
        <ol key={key} className="list-decimal space-y-1 pl-5 leading-7">
          {items}
        </ol>
      );
    }
  }

  return (
    <p key={key} className="leading-7 whitespace-pre-wrap">
      {block.trim()}
    </p>
  );
}

export function renderReportBody(body: string): ReactNode[] {
  const visible = visibleReportBody(body);
  return visible
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block, index) => renderBodyBlock(block, `block-${index}`))
    .filter(Boolean) as ReactNode[];
}

export function ReportLetter({ sections }: ReportLetterProps) {
  return (
    <article className="report-page flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Private report</h1>
      <p className="font-display text-xl leading-8 text-muted">A letter for you.</p>
      <p className="leading-7">Dear you,</p>
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-medium">{section.title}</h2>
          <div className="flex flex-col gap-3">{renderReportBody(section.body)}</div>
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
