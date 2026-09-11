import { CHAPTERS } from "./questionnaire.v2";

export function isLastVisibleQuestion(questionId: string, visibleIds: string[]) {
  return visibleIds.length > 0 && visibleIds.at(-1) === questionId;
}

export function chapterProgress(
  questionId: string,
  visibleIds: string[],
  sectionFor: (id: string) => number,
) {
  const section = sectionFor(questionId);
  const inChapter = visibleIds.filter((id) => sectionFor(id) === section);
  const indexInChapter = Math.max(1, inChapter.indexOf(questionId) + 1);
  const chapter = CHAPTERS[section] ?? `Chapter ${section}`;
  return {
    chapter,
    indexInChapter,
    chapterLength: inChapter.length,
    label: `${chapter} · ${indexInChapter} of ${inChapter.length}`,
  };
}
