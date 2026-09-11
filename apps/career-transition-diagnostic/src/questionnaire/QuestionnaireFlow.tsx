"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { autosaveAnswerAction, runCheckpointAction, submitAssessmentAction } from "@/server/tracer/actions";
import { createAnswerSaveQueue } from "@/questionnaire/answer-save-queue";
import { listAvoidedActionLabels, listVisibleQuestionIds, type SafetyLevel } from "@/questionnaire/branching";
import { ChoiceCards, LabeledScale } from "@/questionnaire/inquiry-inputs";
import { CHAPTERS, getQuestion, questionIds, questions, type QuestionDefinition } from "@/questionnaire/questionnaire.v2";
import { chapterProgress, isLastVisibleQuestion } from "@/questionnaire/questionnaire-progress";
import { CHECKPOINT_AFTER_SECTION } from "@/engine/checkpoints/schema";
import type { AdaptiveCheckpoint } from "@/questionnaire/adaptive";

const SUPPORT_CONTEXT_OPTIONS = [
  "clear_expectations",
  "deadlines",
  "manager_mentor",
  "team",
  "external_accountability",
  "high_autonomy",
  "recognition",
  "stable_income",
  "title_status",
  "competition",
  "playful_atmosphere",
  "clear_tasks",
  "community",
  "responsibility_to_others",
  "frequent_feedback",
  "strong_structure",
  "freedom_from_financial_concern",
  "novelty",
  "other",
];

type AdaptiveQuestionView = {
  id: string;
  checkpoint: AdaptiveCheckpoint;
  forkId: string;
  questionText: string;
};

type QuestionnaireFlowProps = {
  token: string;
  initialAnswers: Record<string, unknown>;
  locked: boolean;
  submitted?: boolean;
  initialAdaptive?: AdaptiveQuestionView[];
  initialSafetyLevel?: SafetyLevel;
  initialSupportCopy?: string | null;
};

function resumeQuestionId(visible: string[], answers: Record<string, unknown>) {
  const answered = [...visible].reverse().find((id) => {
    const value = answers[id];
    return value !== undefined && value !== "";
  });
  return answered ?? visible[0];
}

function clampQuestionId(currentId: string, visible: string[]) {
  if (visible.includes(currentId)) {
    return currentId;
  }
  const currentPos = questionIds.indexOf(currentId);
  return (
    visible.find((id) => questionIds.indexOf(id) >= currentPos) ??
    visible.at(-1) ??
    visible[0]
  );
}

function optionsFor(question: QuestionDefinition, answers: Record<string, unknown>) {
  if (question.id === "Q2.4") {
    return listAvoidedActionLabels(answers);
  }
  if ((question.id === "Q4.4" || question.id === "Q4.5") && !question.options?.length) {
    return SUPPORT_CONTEXT_OPTIONS;
  }
  return question.options;
}

function mergeAdaptiveQuestions(
  catalog: string[],
  adaptive: AdaptiveQuestionView[],
) {
  const next = [...catalog];
  const sectionFor = { A: 2, B: 4, C: 7, D: 9 } as const;
  for (const item of adaptive) {
    if (next.includes(item.id)) {
      continue;
    }
    const section = sectionFor[item.checkpoint];
    let insertAt = next.length;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if (getQuestion(next[index])?.section === section) {
        insertAt = index + 1;
        break;
      }
    }
    next.splice(insertAt, 0, item.id);
  }
  return next;
}

function resolveQuestion(
  id: string,
  adaptive: AdaptiveQuestionView[],
): QuestionDefinition {
  const catalog = getQuestion(id);
  if (catalog) {
    return catalog;
  }
  const injected = adaptive.find((item) => item.id === id);
  if (injected) {
    return {
      id: injected.id,
      section: { A: 2, B: 4, C: 7, D: 9 }[injected.checkpoint],
      prompt: injected.questionText,
      optionality: "branch",
      inputType: "long_text",
    };
  }
  return questions[0];
}

export function QuestionnaireFlow({
  token,
  initialAnswers,
  locked,
  submitted,
  initialAdaptive = [],
  initialSafetyLevel = "none",
  initialSupportCopy = null,
}: QuestionnaireFlowProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>(initialSafetyLevel);
  const [confirming, setConfirming] = useState(false);
  const [supportCopy, setSupportCopy] = useState<string | null>(initialSupportCopy);
  const [adaptive, setAdaptive] = useState<AdaptiveQuestionView[]>(initialAdaptive);
  const [preparing, setPreparing] = useState(false);
  const answersRef = useRef(answers);
  const saveTimer = useRef<number | null>(null);
  const saveQueue = useRef(
    createAnswerSaveQueue(async (id, value) => {
      await autosaveAnswerAction(token, id, JSON.stringify(value));
    }),
  );
  const moving = useRef(false);
  const visible = useMemo(
    () => mergeAdaptiveQuestions(listVisibleQuestionIds(answers, safetyLevel), adaptive),
    [adaptive, answers, safetyLevel],
  );
  const [currentId, setCurrentId] = useState(
    () =>
      resumeQuestionId(
        mergeAdaptiveQuestions(
          listVisibleQuestionIds(initialAnswers, initialSafetyLevel),
          initialAdaptive,
        ),
        initialAnswers,
      ),
  );
  const question = resolveQuestion(clampQuestionId(currentId, visible), adaptive);
  const index = Math.max(0, visible.indexOf(question.id));
  const last = isLastVisibleQuestion(question.id, visible);
  const progress = chapterProgress(question.id, visible, (id) => resolveQuestion(id, adaptive).section);

  function persist(id: string, value: unknown, mode: "now" | "later" = "now") {
    const nextAnswers = { ...answersRef.current, [id]: value };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    saveQueue.current.queue(id, value);
    if (locked) {
      return;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (mode === "later") {
      setStatus("saving");
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void flushPending();
      }, 400);
      return;
    }
    void flushPending();
  }

  async function flushPending() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (locked) {
      return false;
    }
    if (!saveQueue.current.hasPending()) {
      return saveQueue.current.flush();
    }
    setStatus("saving");
    const saved = await saveQueue.current.flush();
    setStatus(saved ? "saved" : "error");
    return saved;
  }

  function currentValue() {
    return (
      answersRef.current[question.id] ??
      (question.inputType === "avoided_actions" ? [] : undefined)
    );
  }

  async function go(delta: number) {
    if (moving.current) {
      return;
    }
    moving.current = true;
    try {
      const value = currentValue();
      if (value !== undefined) {
        persist(question.id, value, "now");
      }
      const saved = await flushPending();
      if (!saved) {
        return;
      }

      if (delta === 1) {
        const checkpoint = CHECKPOINT_AFTER_SECTION[question.section];
        const catalogInSection = visible.filter(
          (id) => getQuestion(id)?.section === question.section,
        );
        const leavingSection = catalogInSection.at(-1) === question.id;
        if (checkpoint && leavingSection) {
          setPreparing(true);
          try {
            const result = await runCheckpointAction(token, checkpoint);
            const nextSafety = result.safetyLevel;
            const nextAdaptive = result.adaptiveQuestion
              ? adaptive.some((item) => item.id === result.adaptiveQuestion?.id)
                ? adaptive
                : [...adaptive, result.adaptiveQuestion]
              : adaptive;
            setSafetyLevel(nextSafety);
            if (result.supportCopy) {
              setSupportCopy(result.supportCopy);
            }
            if (result.adaptiveQuestion) {
              setAdaptive(nextAdaptive);
              setCurrentId(result.adaptiveQuestion.id);
              return;
            }
            setAdaptive(nextAdaptive);
            const nextVisible = mergeAdaptiveQuestions(
              listVisibleQuestionIds(
                {
                  ...answersRef.current,
                  [question.id]: value,
                },
                nextSafety,
              ),
              nextAdaptive,
            );
            const currentIndex = Math.max(0, nextVisible.indexOf(question.id));
            const next = nextVisible[currentIndex + delta];
            if (next) {
              setCurrentId(next);
            }
            return;
          } finally {
            setPreparing(false);
          }
        }
      }

      const nextVisible = mergeAdaptiveQuestions(
        listVisibleQuestionIds(
          {
            ...answersRef.current,
            [question.id]: value,
          },
          safetyLevel,
        ),
        adaptive,
      );
      const currentIndex = Math.max(0, nextVisible.indexOf(question.id));
      const next = nextVisible[currentIndex + delta];
      if (next) {
        setCurrentId(next);
      }
      setConfirming(false);
    } finally {
      moving.current = false;
    }
  }

  async function submitNow() {
    const value = currentValue();
    if (value !== undefined) {
      saveQueue.current.queue(question.id, value);
    }
    const saved = await flushPending();
    if (saved === false) {
      return;
    }
    await submitAssessmentAction(token);
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {CHAPTERS[question.section] ?? progress.chapter}
      </h1>
      <p className="text-sm uppercase tracking-[0.2em] text-terracotta">{progress.label}</p>
      {supportCopy ? (
        <p role="note" className="rounded border border-terracotta bg-paper p-4 text-sm leading-6">
          {supportCopy}
        </p>
      ) : null}
      {preparing ? (
        <p aria-live="polite">Preparing the next part of your reflection…</p>
      ) : null}
      <div key={question.id} className="question-pane">
        <QuestionField
          question={question}
          value={answers[question.id]}
          options={optionsFor(question, answers)}
          locked={locked}
          onChange={(value, mode) => persist(question.id, value, mode)}
        />
      </div>
      <p aria-live="polite" className="text-sm text-muted">
        {status === "error" ? "Could not save. Try again." : null}
        {submitted ? " Submitted. Lena will review before any report is delivered." : null}
      </p>
      {confirming ? (
        <p className="leading-7">Send your answers to Lena for review?</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          className="pressable rounded-full border border-ink px-5 py-3 text-sm disabled:opacity-40"
          type="button"
          onClick={() => {
            void go(-1);
          }}
          disabled={index === 0 || preparing}
        >
          Back
        </button>
        {!last ? (
          <button
            className="pressable rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper disabled:opacity-40"
            type="button"
            onClick={() => {
              void go(1);
            }}
            disabled={preparing}
          >
            Next
          </button>
        ) : confirming ? (
          <button
            className="pressable rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper disabled:opacity-40"
            type="button"
            disabled={locked || preparing}
            onClick={() => {
              startTransition(() => {
                void submitNow();
              });
            }}
          >
            Confirm send
          </button>
        ) : (
          <button
            className="pressable rounded-full border border-terracotta px-5 py-3 text-sm text-terracotta disabled:opacity-40"
            type="button"
            disabled={locked || preparing}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Send to Lena
          </button>
        )}
      </div>
    </section>
  );
}

function QuestionField({
  question,
  value,
  options,
  locked,
  onChange,
}: {
  question: QuestionDefinition;
  value: unknown;
  options?: readonly string[];
  locked: boolean;
  onChange: (value: unknown, mode?: "now" | "later") => void;
}) {
  const fieldId = question.id.replaceAll(".", "-");

  if (question.inputType === "control") {
    return (
      <div className="flex flex-col gap-3">
        <p>{question.prompt}</p>
        <button
          type="button"
          className="w-fit rounded-full border border-terracotta px-4 py-2 text-sm"
          disabled={locked}
          onClick={() => onChange(true)}
        >
          Skip the next few questions
        </button>
      </div>
    );
  }

  if (question.inputType === "select" || question.inputType === "yes_no_unsure") {
    const choices = options ?? question.options ?? ["yes", "no", "unsure"];
    return (
      <ChoiceCards
        prompt={question.prompt}
        name={fieldId}
        multiple={false}
        choices={choices}
        value={value}
        locked={locked}
        onChange={onChange}
      />
    );
  }

  if (question.inputType === "multi_select") {
    const choices = options ?? question.options ?? [];
    return (
      <ChoiceCards
        prompt={question.prompt}
        name={fieldId}
        multiple
        choices={choices}
        value={value}
        locked={locked}
        onChange={onChange}
      />
    );
  }

  if (question.inputType === "scale") {
    return <LabeledScale question={question} value={value} locked={locked} onChange={onChange} />;
  }

  if (question.inputType === "loop") {
    const items = Array.isArray(value) ? (value as string[]) : [""];
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg leading-8">{question.prompt}</p>
        {items.map((item, index) => (
          <input
            key={index}
            className="rounded border border-hairline bg-field p-3"
            value={item}
            disabled={locked}
            aria-label={`Admired figure ${index + 1}`}
            onBlur={(event) =>
              onChange(items.map((current, currentIndex) =>
                currentIndex === index ? event.target.value : current,
              ))
            }
            onChange={(event) => {
              const next = items.map((current, currentIndex) =>
                currentIndex === index ? event.target.value : current,
              );
              onChange(next, "later");
            }}
          />
        ))}
        {items.length < 3 && !locked ? (
          <button
            type="button"
            className="w-fit text-sm underline"
            onClick={() => onChange([...items, ""])}
          >
            Add another
          </button>
        ) : null}
      </div>
    );
  }

  if (question.inputType === "avoided_actions") {
    const items =
      Array.isArray(value) && value.length > 0
        ? (value as { action: string }[])
        : [{ action: "" }];
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg leading-8">{question.prompt}</p>
        {items.map((item, index) => (
          <input
            key={index}
            className="rounded border border-hairline bg-field p-3"
            value={item.action}
            disabled={locked}
            aria-label={`Avoided action ${index + 1}`}
            onBlur={(event) => {
              const next = items.map((current, currentIndex) =>
                currentIndex === index ? { action: event.target.value } : current,
              );
              onChange(next);
            }}
            onChange={(event) => {
              const next = items.map((current, currentIndex) =>
                currentIndex === index ? { action: event.target.value } : current,
              );
              onChange(next, "later");
            }}
          />
        ))}
        {items.length < 3 && !locked ? (
          <button
            type="button"
            className="w-fit text-sm underline"
            onClick={() => onChange([...items, { action: "" }])}
          >
            Add another
          </button>
        ) : null}
      </div>
    );
  }

  if (question.inputType === "paired_text") {
    const pair = (value as { protect?: string; threaten?: string }) ?? {};
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg leading-8">{question.prompt}</p>
        <label>
          Protecting
          <textarea
            className="mt-2 min-h-24 w-full rounded border border-hairline bg-field p-3"
            disabled={locked}
            value={pair.protect ?? ""}
            onBlur={(event) => onChange({ ...pair, protect: event.target.value })}
            onChange={(event) => onChange({ ...pair, protect: event.target.value }, "later")}
          />
        </label>
        <label>
          Threatening
          <textarea
            className="mt-2 min-h-24 w-full rounded border border-hairline bg-field p-3"
            disabled={locked}
            value={pair.threaten ?? ""}
            onBlur={(event) => onChange({ ...pair, threaten: event.target.value })}
            onChange={(event) => onChange({ ...pair, threaten: event.target.value }, "later")}
          />
        </label>
      </div>
    );
  }

  if (question.inputType === "sentence_completions") {
    const stems = [
      "Money comes when…",
      "People who make a lot of money are…",
      "To deserve good money I need to…",
      "Work should feel…",
      "If making money becomes difficult, it means…",
      "If I followed what I truly wanted, money would…",
    ];
    const completions = Array.isArray(value) ? (value as string[]) : stems.map(() => "");
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg leading-8">{question.prompt}</p>
        {stems.map((stem, index) => (
          <label key={stem} className="flex flex-col gap-2">
            {stem}
            <input
              className="rounded border border-hairline bg-field p-3"
              disabled={locked}
              value={completions[index] ?? ""}
              onBlur={(event) => {
                const next = stems.map((_, currentIndex) =>
                  currentIndex === index ? event.target.value : (completions[currentIndex] ?? ""),
                );
                onChange(next);
              }}
              onChange={(event) => {
                const next = stems.map((_, currentIndex) =>
                  currentIndex === index ? event.target.value : (completions[currentIndex] ?? ""),
                );
                onChange(next, "later");
              }}
            />
          </label>
        ))}
      </div>
    );
  }

  const isLong = question.inputType === "long_text";
  return (
    <label className="flex flex-col gap-3">
      <span className="text-lg leading-8">{question.prompt}</span>
      {isLong ? (
        <textarea
          id={fieldId}
          className="min-h-40 rounded border border-hairline bg-field p-3"
          disabled={locked}
          value={typeof value === "string" ? value : ""}
          onBlur={(event) => onChange(event.target.value)}
          onChange={(event) => onChange(event.target.value, "later")}
        />
      ) : (
        <input
          id={fieldId}
          className="rounded border border-hairline bg-field p-3"
          disabled={locked}
          value={typeof value === "string" ? value : ""}
          onBlur={(event) => onChange(event.target.value)}
          onChange={(event) => onChange(event.target.value, "later")}
        />
      )}
    </label>
  );
}
