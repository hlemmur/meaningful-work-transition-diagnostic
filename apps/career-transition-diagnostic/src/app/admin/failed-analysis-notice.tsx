export function FailedAnalysisNotice({
  stage,
  error,
}: {
  stage?: string;
  error?: string | null;
}) {
  if (!stage) {
    return null;
  }

  return (
    <>
      <p>Failed stage: {stage}</p>
      {error ? <p>Failure detail: {error}</p> : null}
    </>
  );
}
