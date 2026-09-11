import { optionLabel, type QuestionDefinition } from "./questionnaire.v2";

function safeOptionLabel(option: string) {
  try {
    return optionLabel(option);
  } catch {
    return option;
  }
}

type ChoiceCardsProps = {
  prompt: string;
  name: string;
  multiple: boolean;
  choices: readonly string[];
  value: unknown;
  locked: boolean;
  onChange: (value: unknown) => void;
};

export function ChoiceCards({
  prompt,
  name,
  multiple,
  choices,
  value,
  locked,
  onChange,
}: ChoiceCardsProps) {
  const selected = Array.isArray(value) ? (value as string[]) : [];

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg leading-8">{prompt}</legend>
      {choices.map((option) => {
        const checked = multiple ? selected.includes(option) : value === option;
        return (
          <label
            key={option}
            className={`choice-card flex min-h-11 cursor-pointer items-center gap-3 rounded border px-4 py-3 ${
              checked ? "border-terracotta bg-field" : "border-hairline bg-field"
            } ${locked ? "opacity-40" : ""}`}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={multiple ? undefined : name}
              value={option}
              checked={checked}
              disabled={locked}
              onChange={(event) => {
                if (multiple) {
                  const next = event.target.checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option);
                  onChange(next);
                  return;
                }
                onChange(option);
              }}
            />
            {safeOptionLabel(option)}
          </label>
        );
      })}
    </fieldset>
  );
}

type LabeledScaleProps = {
  question: QuestionDefinition;
  value: unknown;
  locked: boolean;
  onChange: (value: unknown, mode?: "now" | "later") => void;
};

export function scalePoles(question: Pick<QuestionDefinition, "id" | "options">) {
  const bodyRegions = question.options?.includes("chest") || question.id === "Q3.2";
  if (bodyRegions) {
    return {
      min: "Nothing noticeable",
      max: "Fully present in the body",
      regions: question.options ?? [],
    };
  }
  return { min: "Not at all", max: "Completely", regions: [] as readonly string[] };
}

export function LabeledScale({ question, value, locked, onChange }: LabeledScaleProps) {
  const poles = scalePoles(question);
  const fieldId = question.id.replaceAll(".", "-");
  const numeric = Number(value ?? 0);

  return (
    <label className="flex flex-col gap-3">
      <span className="text-lg leading-8">{question.prompt}</span>
      <input
        id={fieldId}
        type="range"
        min={0}
        max={10}
        disabled={locked}
        value={numeric}
        onChange={(event) => onChange(Number(event.target.value), "later")}
        onBlur={(event) => onChange(Number(event.target.value))}
      />
      <span className="flex justify-between text-sm text-muted">
        <span>{poles.min}</span>
        <span>{poles.max}</span>
      </span>
      {poles.regions.length > 0 ? (
        <p className="text-sm text-muted">
          {poles.regions.map((region) => optionLabel(region)).join(" · ")}
        </p>
      ) : null}
      <span>{numeric}</span>
    </label>
  );
}
