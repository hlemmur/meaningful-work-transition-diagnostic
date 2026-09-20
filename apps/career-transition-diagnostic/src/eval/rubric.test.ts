import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { REQUIRED_PEEL_SECTION_IDS } from "@/engine/schemas/analysis";
import { evaluateReport } from "./rubric";

function chargeCase(chargeIntensity: number, emotion: string) {
  const state = emptyCaseState("a1");
  state.affect.chargeIntensity = chargeIntensity;
  state.affect.emotions = [
    {
      id: "a1:Q3.1",
      assessmentId: "a1",
      questionId: "Q3.1",
      rawQuote: emotion,
      normalizedMeaning: emotion,
      evidenceType: "emotion",
    },
  ];
  return state;
}

describe("evaluateReport evidence grounding", () => {
  const section = (
    id: string,
    body: string,
    evidenceRefs: string[],
  ) => ({
    id: id as (typeof REQUIRED_PEEL_SECTION_IDS)[number],
    title:
      id === "problem"
        ? "The problem as you see it"
        : id === "reality"
          ? "What reality says"
          : id === "contradiction"
            ? "The contradiction at the center"
            : id === "alternative"
              ? "Another plausible interpretation"
              : id === "experiment"
                ? "Your experiment"
                : id === "jungian"
                  ? "A Jungian lens"
                  : id === "questions"
                    ? "Three questions to stay with"
                    : id === "close"
                      ? "A working formulation"
                      : id,
    body,
    evidenceRefs,
  });

  it("fails when every section cites only one question id like the live miss", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: REQUIRED_PEEL_SECTION_IDS.map((id) =>
          section(
            id,
            "You seek sharp angles that you cannot unsee to shift perspective toward your vision.",
            ["a1:Q0.5"],
          ),
        ),
      },
      requestedInsight: "sharp angles that I can't unsee and will help me to shift my perspective",
    });
    expect(result.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "diverse-evidence-refs")?.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "requested-insight-spine")?.passed).toBe(false);
  });

  it("passes a multi-ref peel report that is not Q11.3-only", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          section("problem", "Your stall shows up as freezing when marketing the coaching offer.", [
            "a1:Q1.1",
          ]),
          section("reality", "Your money pressure and ADHD constraints are part of the picture.", [
            "a1:Q0.4",
            "a1:Q0.5",
          ]),
          section("contradiction", "You want exposure and keep the website secret.", [
            "a1:Q1.1",
            "a1:Q1.3",
          ]),
          section("alternative", "Your practical skill and structure gap may be enough without depth.", [
            "a1:Q0.5",
          ]),
          section("experiment", "Two weeks of external deadlines tests whether your structure restores motion.", [
            "a1:Q1.1",
          ]),
          section(
            "questions",
            "What would make you question this explanation? What changes when you test structure directly? What still feels unexplained to you?",
            ["a1:Q1.1", "a1:Q1.3"],
          ),
          section(
            "close",
            "You can treat this as a working formulation rather than a verdict.",
            ["a1:Q1.1"],
          ),
        ],
      },
      requestedInsight: "sharp angles that I can't unsee",
    });
    expect(result.findings.find((item) => item.id === "diverse-evidence-refs")?.passed).toBe(true);
    expect(result.findings.find((item) => item.id === "requested-insight-spine")?.passed).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("fails inflation-shaped eternal-youth / puer identity framing", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          section("problem", "You stall because you are an eternal youth who refuses incarnation.", [
            "a1:Q1.1",
          ]),
          section("reality", "Your money pressure and ADHD constraints are part of the picture.", [
            "a1:Q0.4",
            "a1:Q0.5",
          ]),
          section("contradiction", "You want exposure and keep the website secret.", [
            "a1:Q1.1",
            "a1:Q1.3",
          ]),
          section("alternative", "Your practical skill and structure gap may be enough without depth.", [
            "a1:Q0.5",
          ]),
          section("experiment", "Two weeks of external deadlines tests whether your structure restores motion.", [
            "a1:Q1.1",
          ]),
          section(
            "jungian",
            "You are a puer; the unanchored ideal is the whole frame of your stall.",
            ["a1:Q2.1"],
          ),
        ],
      },
    });
    expect(result.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "eternal-youth-identity")?.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "unanchored-ideal-alone")?.passed).toBe(false);
  });

  it("passes polarity framing and requires charge language when affect is indicated", () => {
    const withCharge = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          section("problem", "You freeze at exposure after years of container-supported work.", [
            "a1:Q1.1",
          ]),
          section("reality", "Your money pressure and ADHD constraints are part of the picture.", [
            "a1:Q0.4",
            "a1:Q0.5",
          ]),
          section(
            "contradiction",
            "Your freedom and structure form a polarity; both compensation and incarnation are in play.",
            ["a1:Q1.1", "a1:Q1.3"],
          ),
          section("alternative", "Your practical skill and structure gap may be enough without depth.", [
            "a1:Q0.5",
          ]),
          section(
            "experiment",
            "Two weeks of stakes tests whether your body charge shifts with accountability.",
            ["a1:Q1.1"],
          ),
          section(
            "questions",
            "What would make you question this polarity reading? What changes for you under real accountability? What still feels unexplained to you?",
            ["a1:Q1.1", "a1:Q1.3"],
          ),
          section(
            "close",
            "You can treat this as a working formulation rather than a verdict.",
            ["a1:Q1.1"],
          ),
        ],
      },
      caseState: chargeCase(2, "shame"),
    });
    expect(withCharge.findings.find((item) => item.id === "charge-language")?.passed).toBe(true);
    expect(withCharge.passed).toBe(true);

    const withoutCharge = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          section("problem", "You stall when marketing the coaching offer after leaving IT.", [
            "a1:Q1.1",
          ]),
          section("reality", "Your money pressure and ADHD constraints are part of the picture.", [
            "a1:Q0.4",
            "a1:Q0.5",
          ]),
          section(
            "contradiction",
            "Your freedom and structure form a polarity with compensation in play.",
            ["a1:Q1.1", "a1:Q1.3"],
          ),
          section("alternative", "Your practical skill and structure gap may be enough without depth.", [
            "a1:Q0.5",
          ]),
          section("experiment", "Two weeks of external deadlines tests whether your structure restores motion.", [
            "a1:Q1.1",
          ]),
        ],
      },
      caseState: chargeCase(3, "terror"),
    });
    expect(withoutCharge.findings.find((item) => item.id === "charge-language")?.passed).toBe(false);
    expect(withoutCharge.passed).toBe(false);
  });

  it("accepts supplied emotion language without requiring a body location", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          section("problem", "You feel fear when the work becomes publicly visible.", ["a1:Q1.1"]),
          section("reality", "Your financial constraints remain a practical part of the picture.", ["a1:Q0.5"]),
          section("contradiction", "You want meaningful visibility and repeatedly avoid the smallest public test.", ["a1:Q1.1", "a1:Q1.3"]),
          section("alternative", "A skill or job-shape mismatch may explain the same pattern.", ["a1:Q0.5"]),
          section("experiment", "Run one bounded visibility test and compare fear with actual response.", ["a1:Q1.3"]),
          section("questions", "What would weaken this formulation? What changes after one test? What remains unexplained?", ["a1:Q1.1", "a1:Q1.3"]),
          section("close", "Treat this as a working formulation to test, not a verdict.", ["a1:Q1.1"]),
        ],
      },
      caseState: chargeCase(2, "fear"),
    });

    expect(result.findings.find((item) => item.id === "charge-language")?.passed).toBe(true);
  });

  it("fails clinical third-person analyst voice", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          {
            id: "problem" as const,
            title: "The Stated Predicament and Economic Pressure",
            body: "The client presents a compelling stall after leaving IT for coaching.",
            evidenceRefs: ["a1:Q1.1"],
          },
          {
            id: "reality" as const,
            title: "What reality says",
            body: "Examining the deeper structural layers shows money pressure and ADHD constraints.",
            evidenceRefs: ["a1:Q0.4", "a1:Q0.5"],
          },
          {
            id: "contradiction" as const,
            title: "The contradiction at the center",
            body: "The client wants exposure and keeps the website secret.",
            evidenceRefs: ["a1:Q1.1", "a1:Q1.3"],
          },
          {
            id: "alternative" as const,
            title: "Another plausible interpretation",
            body: "The client's stall may be a practical skill gap.",
            evidenceRefs: ["a1:Q0.5"],
          },
          {
            id: "experiment" as const,
            title: "Your experiment",
            body: "The client should try two weeks of external deadlines.",
            evidenceRefs: ["a1:Q1.1"],
          },
        ],
      },
    });
    expect(result.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "second_person")?.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "plain_titles")?.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "no_analyst_openers")?.passed).toBe(false);
  });
});
