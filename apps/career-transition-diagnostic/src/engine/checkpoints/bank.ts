import type { ForkId } from "../schemas/analysis";

export const ADAPTIVE_QUESTION_BANK: Record<
  ForkId,
  { questionText: string; shameOrIdentity?: boolean }
> = {
  history_vs_stated_cause: {
    questionText:
      "You named a cause. Which parts of that have you already tried to solve — and what still didn’t move?",
  },
  impostor_filter_vs_inexperience: {
    questionText:
      "When someone who knows your work calls it good, what happens inside you in the next hour?",
    shameOrIdentity: true,
  },
  container_loss_vs_capacity: {
    questionText:
      "If a trusted person set weekly deadlines and reviewed output — without changing your skills — what would likely change in 14 days?",
  },
  legitimacy_loop: {
    questionText:
      "What would “enough proof” actually look like — and who would have to give it?",
    shameOrIdentity: true,
  },
  work_vs_identity_vs_job_shape: {
    questionText:
      "If the work stayed and the audience / title / client volume changed, which loss would you feel first?",
  },
  money_infrastructure_vs_misalignment: {
    questionText:
      "Who, in the easy-money period, was doing the selling, pricing, and finding of demand — even if that wasn’t your job title?",
  },
  background_income_relief_vs_replacement: {
    questionText:
      "If the background money required a boring three-hour weekly task, would you still want it — and what would that task be replacing?",
  },
  rational_caution_vs_hidden_bargain: {
    questionText:
      "If staying put were actually the wise move given your constraints, what would you be glad you didn’t rush? If it were not wise, what would you be using caution to postpone?",
  },
};

export const CHECKPOINT_PREFERRED_FORKS: Record<string, ForkId[]> = {
  A: ["history_vs_stated_cause"],
  B: [
    "container_loss_vs_capacity",
    "impostor_filter_vs_inexperience",
    "legitimacy_loop",
  ],
  C: ["work_vs_identity_vs_job_shape"],
  D: [
    "rational_caution_vs_hidden_bargain",
    "background_income_relief_vs_replacement",
  ],
};

export const JUNG_SPEAK_PATTERN =
  /\b(puer|anima|animus|shadow|archetype|individuation|complex)\b/i;
export const LEADING_PATTERN = /don't you think|isn't it true that|you are a /i;

export const SUPPORT_COPY =
  "If you are in crisis or not safe, contact local emergency services or a trusted professional. You can continue with practical questions only. This diagnostic is not therapy or emergency care.";
