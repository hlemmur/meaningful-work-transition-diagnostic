export const QUESTIONNAIRE_VERSION = "questionnaire.v2" as const;

export type QuestionOptionality = "always" | "optional" | "branch";

export type QuestionInputType =
  | "select"
  | "long_text"
  | "short_text"
  | "scale"
  | "multi_select"
  | "yes_no_unsure"
  | "avoided_actions"
  | "control"
  | "loop"
  | "paired_text"
  | "sentence_completions";

export type QuestionDefinition = {
  id: string;
  section: number;
  prompt: string;
  optionality: QuestionOptionality;
  inputType: QuestionInputType;
  options?: readonly string[];
};

export const questions: QuestionDefinition[] = [
  {
    id: "Q0.1",
    section: 0,
    prompt: "Which best describes your current situation?",
    optionality: "always",
    inputType: "select",
    options: [
      "employed_considering",
      "employed_transitioning",
      "leave_sabbatical",
      "unemployed",
      "self_employed",
      "building_business",
      "retraining",
      "portfolio",
      "other",
    ],
  },
  {
    id: "Q0.1b",
    section: 0,
    prompt: "Anything to add so we don’t misread your situation?",
    optionality: "optional",
    inputType: "short_text",
  },
  {
    id: "Q0.2",
    section: 0,
    prompt: "Briefly describe your professional background and the work you’ve done so far.",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q0.3",
    section: 0,
    prompt: "How long has this transition or work-related struggle been present?",
    optionality: "always",
    inputType: "select",
    options: [
      "under_3_months",
      "3_12_months",
      "1_2_years",
      "2_5_years",
      "more_than_5_years",
      "comes_and_goes",
    ],
  },
  {
    id: "Q0.3b",
    section: 0,
    prompt: "If the timeline is more complicated than that, say so.",
    optionality: "optional",
    inputType: "short_text",
  },
  {
    id: "Q0.4",
    section: 0,
    prompt: "How much practical pressure is there to resolve this situation soon?",
    optionality: "always",
    inputType: "scale",
  },
  {
    id: "Q0.4b",
    section: 0,
    prompt: "What creates that pressure?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q0.5",
    section: 0,
    prompt:
      "Are there circumstances the report should take seriously rather than interpret psychologically?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q1.1",
    section: 1,
    prompt: "In your own words, what is the work/career situation you’re struggling with right now?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q1.2",
    section: 1,
    prompt:
      "If this situation resolved in the way you currently hope, what would your work and life look like one or two years from now?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q1.3",
    section: 1,
    prompt: "In your own words, why aren’t you there yet?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q1.3b",
    section: 1,
    prompt:
      "After writing that: do any of these sound like your current explanation (not the deeper truth)?",
    optionality: "optional",
    inputType: "multi_select",
    options: [
      "dont_know_what_i_want",
      "financial_insecurity",
      "fear_of_failure",
      "fear_of_success",
      "fear_of_judgment",
      "lack_of_confidence",
      "lack_of_skills",
      "lack_of_opportunities",
      "burnout",
      "too_many_possibilities",
      "difficulty_executing",
      "difficulty_committing",
      "responsibilities_to_others",
      "labor_market",
      "business_marketing",
      "something_else",
      "none_of_these",
    ],
  },
  {
    id: "Q1.4",
    section: 1,
    prompt: "Imagine those obstacles disappeared tomorrow. What would you actually do next?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q1.5",
    section: 1,
    prompt: "What do you currently believe would finally make you feel ready?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q2.1",
    section: 2,
    prompt: "When did you first know something significant needed to change? What happened?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q2.2",
    section: 2,
    prompt: "What have you actually done since then to change the situation?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q2.3",
    section: 2,
    prompt:
      "Name up to three actions you’ve seriously intended to take but have repeatedly postponed, avoided, or abandoned.",
    optionality: "always",
    inputType: "avoided_actions",
  },
  {
    id: "Q2.4",
    section: 2,
    prompt: "Which one of these matters most right now?",
    optionality: "branch",
    inputType: "select",
  },
  {
    id: "Q2.4F",
    section: 2,
    prompt:
      "If you had to name the single next action you believe you should take — even if you haven’t been avoiding it in a dramatic way — what is it?",
    optionality: "branch",
    inputType: "short_text",
  },
  {
    id: "Q2.5a",
    section: 2,
    prompt: "What changed as a result of what you’ve tried?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q2.5b",
    section: 2,
    prompt: "What stubbornly did not change?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q2.6",
    section: 2,
    prompt: "Have there been periods when the problem temporarily disappeared or became much easier?",
    optionality: "always",
    inputType: "yes_no_unsure",
  },
  {
    id: "Q2.6b",
    section: 2,
    prompt: "What was different then?",
    optionality: "branch",
    inputType: "long_text",
  },
  {
    id: "Q3.1",
    section: 3,
    prompt: "Imagine that tomorrow you actually do this. Without analyzing it, notice what happens inside you.",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q3.2",
    section: 3,
    prompt: "What happens in your body?",
    optionality: "always",
    inputType: "scale",
    options: ["chest", "throat", "stomach", "shoulders", "face", "elsewhere", "nothing_noticeable"],
  },
  {
    id: "Q3.3",
    section: 3,
    prompt: "What emotion appears first?",
    optionality: "always",
    inputType: "select",
    options: [
      "fear",
      "shame",
      "anger",
      "sadness",
      "excitement",
      "relief",
      "disgust",
      "helplessness",
      "other",
    ],
  },
  {
    id: "Q3.3S",
    section: 3,
    prompt: "This feels like too much — skip the next few questions.",
    optionality: "always",
    inputType: "control",
  },
  {
    id: "Q3.4",
    section: 3,
    prompt: "What’s the first thought?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q3.5",
    section: 3,
    prompt: "If you actually did this, who do you imagine seeing it?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q3.6",
    section: 3,
    prompt: "What do you imagine they would think?",
    optionality: "branch",
    inputType: "short_text",
  },
  {
    id: "Q3.7",
    section: 3,
    prompt: "What’s the worst thing you imagine could realistically happen?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q3.8",
    section: 3,
    prompt: "If that happened, what would that mean about you?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q3.9",
    section: 3,
    prompt: "And if that were true, what would that mean about who you are?",
    optionality: "branch",
    inputType: "long_text",
  },
  {
    id: "Q3.10",
    section: 3,
    prompt: "What would you want to do immediately after experiencing that outcome?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q4.1",
    section: 4,
    prompt:
      "Does the feeling or belief you just described resemble anything you’ve experienced in previous jobs, studies, relationships, or earlier periods of life?",
    optionality: "always",
    inputType: "yes_no_unsure",
  },
  {
    id: "Q4.2",
    section: 4,
    prompt:
      "Has the same conclusion about yourself appeared in other contexts — including times that looked successful from the outside?",
    optionality: "always",
    inputType: "yes_no_unsure",
  },
  {
    id: "Q4.2b",
    section: 4,
    prompt:
      "Think of a time you had solid evidence you were competent or successful. What did your mind typically do with that evidence?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q4.3",
    section: 4,
    prompt: "Think of a period when work felt unusually easy, alive, or functional. What was that period?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q4.4",
    section: 4,
    prompt: "What existed around you then that helped you function?",
    optionality: "always",
    inputType: "multi_select",
  },
  {
    id: "Q4.5",
    section: 4,
    prompt: "Which of these are missing now?",
    optionality: "always",
    inputType: "multi_select",
  },
  {
    id: "Q4.6",
    section: 4,
    prompt: "Which of these do you now expect yourself to provide internally — without much external help?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q4.7",
    section: 4,
    prompt:
      "How do you tend to function when nobody is waiting for the result, evaluating you, paying you, or expecting you to show up?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q4.8",
    section: 4,
    prompt: "What happens when someone or something does create clear expectations and accountability?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q4.9",
    section: 4,
    prompt:
      "Do you feel you need proof before claiming this role — and that the proof can only come after you claim it?",
    optionality: "always",
    inputType: "scale",
  },
  {
    id: "Q5.1",
    section: 5,
    prompt:
      "Think of one to three people whose working lives provoke envy, fascination, or longing.",
    optionality: "always",
    inputType: "loop",
  },
  {
    id: "Q5.2",
    section: 5,
    prompt: "What exactly about their life do you want?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q5.3",
    section: 5,
    prompt: "What do they seem allowed to have or be that you are not?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q5.4",
    section: 5,
    prompt: "Imagine an ordinary Tuesday in their life. What do you imagine it feels like?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q5.5",
    section: 5,
    prompt:
      "What part of their Tuesday are you imagining clearly — and what part have you never really needed to know?",
    optionality: "always",
    inputType: "short_text",
  },
  {
    id: "Q6.1",
    section: 6,
    prompt:
      "Think of people whose relationship with work, money, or ambition strongly irritates you or makes you judge them.",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q6.2",
    section: 6,
    prompt: "What exactly bothers you about them?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q6.3",
    section: 6,
    prompt: "What would feel unbearable about becoming like them?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q6.4",
    section: 6,
    prompt: "Is there anything in their way of living that might secretly make your life easier?",
    optionality: "optional",
    inputType: "long_text",
  },
  {
    id: "Q6.5",
    section: 6,
    prompt:
      "Whose judgment would make your career choice feel like a failure even if you were personally satisfied?",
    optionality: "branch",
    inputType: "short_text",
  },
  {
    id: "Q6.5s",
    section: 6,
    prompt: "Anyone else whose judgment would sting — besides who you already named?",
    optionality: "branch",
    inputType: "short_text",
  },
  {
    id: "Q6.6",
    section: 6,
    prompt: "What do you imagine that person or group would think about you?",
    optionality: "branch",
    inputType: "short_text",
  },
  {
    id: "Q7.1",
    section: 7,
    prompt:
      "Imagine your transition has worked beautifully. It is three years from now. Describe an ordinary Tuesday — not a highlight day.",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.2",
    section: 7,
    prompt: "Which parts of this future give you the strongest sense of aliveness?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.3",
    section: 7,
    prompt: "Which activities actually generate the money?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.4",
    section: 7,
    prompt: "What parts would probably be boring, repetitive, or frustrating?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.5",
    section: 7,
    prompt:
      "Imagine you could have the title, social identity, recognition, and lifestyle associated with this future — but your daily work would be completely different. What would you miss most?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.6",
    section: 7,
    prompt:
      "Now the opposite: you can do the actual work you desire every day, but nobody finds your career impressive. Would you still want the work?",
    optionality: "always",
    inputType: "scale",
  },
  {
    id: "Q7.7",
    section: 7,
    prompt:
      "Suppose you became objectively successful at this work, but after a year some parts remained consistently tiring, mundane, or difficult. What would make you continue anyway?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.8",
    section: 7,
    prompt:
      "What would make you decide the imagined direction itself was wrong rather than simply difficult?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q7.9",
    section: 7,
    prompt:
      "If you could keep the work that feels meaningful, but change the form of the job — what would you change first?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.1",
    section: 8,
    prompt: "Complete the money sentences.",
    optionality: "always",
    inputType: "sentence_completions",
  },
  {
    id: "Q8.2",
    section: 8,
    prompt: "When in your life has earning money felt easiest?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.3",
    section: 8,
    prompt: "What was the actual structure that produced the money during that period?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.4",
    section: 8,
    prompt: "What parts of that economic structure were mostly invisible to you at the time?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.5",
    section: 8,
    prompt: "When has earning money felt hardest?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.6",
    section: 8,
    prompt: "What changed between the easy-money and difficult-money periods?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.7",
    section: 8,
    prompt: "What relationship between effort and money feels fair or desirable to you?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.8",
    section: 8,
    prompt: "What kind of work would you refuse to do even if it paid very well?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.9",
    section: 8,
    prompt: "What kind of work would you continue doing even if it initially paid poorly?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q8.10",
    section: 8,
    prompt:
      "If something else quietly covered enough money for a while, what would you stop forcing — and what would you finally do?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q9.1",
    section: 9,
    prompt:
      "Imagine nothing changes and your current pattern continues for another five years. What would you lose?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q9.2",
    section: 9,
    prompt: "What would you get to keep?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q9.3",
    section: 9,
    prompt:
      "If this pattern isn’t stupidity or self-sabotage, what might staying where you are be protecting — and what would changing threaten?",
    optionality: "always",
    inputType: "paired_text",
  },
  {
    id: "Q9.4",
    section: 9,
    prompt: "If your desired future became real tomorrow, what would you have to give up?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q9.5",
    section: 9,
    prompt:
      "What responsibility would success force you to take that you do not currently have to take?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q9.6",
    section: 9,
    prompt:
      "What would failure force you to know that uncertainty currently allows you not to know?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q9.7",
    section: 9,
    prompt:
      "If this difficulty weren’t only a problem to remove, what might it be asking you to become capable of?",
    optionality: "optional",
    inputType: "long_text",
  },
  {
    id: "Q10.1",
    section: 10,
    prompt:
      "Imagine your current work transition as a place or scene. Don’t try to make it clever. Take the first image that comes. Where are you?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q10.2",
    section: 10,
    prompt: "What’s around you?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q10.3",
    section: 10,
    prompt: "What prevents movement?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q10.4",
    section: 10,
    prompt: "What lies ahead?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q10.5",
    section: 10,
    prompt: "Is anyone or anything else present?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q10.6",
    section: 10,
    prompt: "If the thing preventing movement could speak, what would it say?",
    optionality: "branch",
    inputType: "long_text",
  },
  {
    id: "Q10.7",
    section: 10,
    prompt: "What does it want from you?",
    optionality: "optional",
    inputType: "long_text",
  },
  {
    id: "Q10.8",
    section: 10,
    prompt: "What happens if you do not try to remove it?",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q11.1",
    section: 11,
    prompt: "Did anything surprise you while answering? You don’t need a new theory of your problem.",
    optionality: "always",
    inputType: "long_text",
  },
  {
    id: "Q11.2",
    section: 11,
    prompt: "Has your explanation shifted at all from the one you started with?",
    optionality: "always",
    inputType: "select",
    options: ["yes", "somewhat", "no", "not_sure"],
  },
  {
    id: "Q11.3",
    section: 11,
    prompt: "What are you hoping this report will see that you cannot currently see yourself?",
    optionality: "always",
    inputType: "long_text",
  },
];

export const questionIds = questions.map((question) => question.id);

export function getQuestion(id: string): QuestionDefinition | undefined {
  return questions.find((question) => question.id === id);
}
