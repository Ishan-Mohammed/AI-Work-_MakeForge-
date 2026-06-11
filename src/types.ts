export interface Flashcard {
  front: string;
  back: string;
}

export interface KeyConcept {
  concept: string;
  summary: string;
}

export interface RevisionCard {
  topic: string;
  points: string[];
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
