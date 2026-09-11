export type BenchmarkId =
  | "self-authorization"
  | "labor-market"
  | "job-shape-mismatch"
  | "rational-caution"
  | "weak-no-depth";

export type BenchmarkCase = {
  id: BenchmarkId;
  label: string;
  answers: Record<string, unknown>;
};

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: "self-authorization",
    label: "Lena-like self-authorization",
    answers: {
      "Q1.1": "I already know the work I want and still cannot authorize myself to do it.",
      "Q1.3": "I keep waiting for someone else to confirm I am allowed.",
      "Q2.2": "I built the offer and then froze before sending it.",
      "Q11.3": "See the contradiction between knowing and authorizing.",
    },
  },
  {
    id: "labor-market",
    label: "Practical labor-market constraint",
    answers: {
      "Q0.5": "Visa status and a local hiring freeze. I cannot legally take the role yet.",
      "Q1.1": "I want the new field, but the market in front of me is closed.",
      "Q1.3": "I tell myself I am not trying hard enough.",
      "Q2.2": "I keep applying into the freeze anyway.",
    },
  },
  {
    id: "job-shape-mismatch",
    label: "Genuine job-shape mismatch",
    answers: {
      "Q1.1": "One-to-one high-volume work drains me even when people get value. IMAGE_WEAKENS",
      "Q1.3": "I thought the vocation was wrong because I get tired.",
      "Q2.2": "I kept adding more clients instead of changing the job-shape.",
      "Q10.1": "An empty landscape with no path. IMAGE_WEAKENS",
    },
  },
  {
    id: "rational-caution",
    label: "Rational caution",
    answers: {
      "Q0.5": "CRITIC_CONSTRAINTS_WIN Background income covers the bills; leaving it this year would be reckless.",
      "Q1.1": "I want the move and I also refuse to blow up a working household plan.",
      "Q1.3": "People call this resistance.",
      "Q2.2": "I ran the numbers twice and waited.",
    },
  },
  {
    id: "weak-no-depth",
    label: "Weak/no-depth interpretation",
    answers: {
      "Q1.1": "EMPTY_JUNGIAN I need a clearer job description, not a symbolic reading.",
      "Q1.3": "I am confused about title and hours, not about my soul.",
      "Q2.2": "I compared three role descriptions.",
    },
  },
];
