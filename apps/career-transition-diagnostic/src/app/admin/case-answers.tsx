function formatAnswer(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

type CaseAnswersProps = {
  answers: Record<string, unknown>;
};

export function CaseAnswers({ answers }: CaseAnswersProps) {
  const entries = Object.entries(answers);
  return (
    <aside className="rounded border border-hairline bg-field p-4">
      <h2 className="font-medium">Answers</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No answers stored.</p>
      ) : (
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          {entries.map(([id, value]) => (
            <div key={id}>
              <dt className="font-medium">{id}</dt>
              <dd className="mt-1 break-words text-muted">{formatAnswer(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
