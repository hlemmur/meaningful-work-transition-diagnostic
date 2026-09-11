import Link from "next/link";
import { humanAnalysisStatus, humanSafetyLevel, humanStatus } from "./operator-copy";

export type ReviewQueueRow = {
  id: string;
  email: string;
  status: string;
  safetyLevel: string;
  analysisStatus: string;
};

type ReviewQueueTableProps = {
  queue: ReviewQueueRow[];
};

export function ReviewQueueTable({ queue }: ReviewQueueTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-left">
          <th className="py-2 pr-3 font-medium">Email</th>
          <th className="py-2 pr-3 font-medium">Status</th>
          <th className="py-2 pr-3 font-medium">Safety</th>
          <th className="py-2 pr-3 font-medium">Analysis</th>
          <th className="py-2 font-medium">Case</th>
        </tr>
      </thead>
      <tbody>
        {queue.map((assessment) => (
          <tr
            key={assessment.id}
            data-assessment-id={assessment.id}
            data-safety-level={assessment.safetyLevel}
            data-analysis-status={assessment.analysisStatus}
            className="border-b border-hairline"
          >
            <td className="py-3 pr-3">{assessment.email}</td>
            <td className="py-3 pr-3">{humanStatus(assessment.status)}</td>
            <td className="py-3 pr-3">{humanSafetyLevel(assessment.safetyLevel)}</td>
            <td className="py-3 pr-3">{humanAnalysisStatus(assessment.analysisStatus)}</td>
            <td className="py-3">
              <Link className="underline" href={`/admin/${assessment.id}`}>
                Open case
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
