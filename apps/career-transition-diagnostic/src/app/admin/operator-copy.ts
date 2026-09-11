export function humanStatus(status: string) {
  switch (status) {
    case "review_pending":
      return "Waiting for review";
    case "approved":
      return "Approved";
    case "deleted":
      return "Access removed";
    case "in_progress":
      return "In progress";
    default:
      return status.replaceAll("_", " ");
  }
}

export function humanSafetyLevel(level: string) {
  switch (level) {
    case "none":
      return "None";
    case "high":
      return "High";
    default:
      return level;
  }
}

export function humanAnalysisStatus(label: string) {
  switch (label) {
    case "not started":
      return "Not started";
    case "completed":
      return "Completed";
    default:
      return label;
  }
}
