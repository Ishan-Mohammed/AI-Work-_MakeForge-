export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface KeyConcept {
  concept: string;
  definition: string;
  tag: string;
}

export interface RevisionCard {
  topic: string;
  bullets: string[];
}

export interface StudyMaterial {
  flashcards: Flashcard[];
  keyConcepts: KeyConcept[];
  revisionCards: RevisionCard[];
}

export type ProcessingStep = 
  | "idle"
  | "reading"
  | "extracting"
  | "flashcards"
  | "revision"
  | "completed"
  | "retrying"
  | "failed";
