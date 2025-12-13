
export type AppMode = 'welcome' | 'igcse-subject-select' | 'igcse-workspace' | 'general-workspace' | 'saved-questions' | 'saved-notes';

export const IGCSE_SUBJECTS = {
  pak_studies_p1: 'PakStudies P1',
  pak_studies_p2: 'PakStudies P2',
  islamiyat_p1: 'Islamiyat P1',
  islamiyat_p2: 'Islamiyat P2',
  physics_p1: 'Physics P1',
  physics_p2: 'Physics P2',
  physics_p4: 'Physics P4',
  chemistry_p1: 'Chemistry P1',
  chemistry_p2: 'Chemistry P2',
  chemistry_p4: 'Chemistry P4',
  cs_p1: 'Computer Science P1',
  cs_p2: 'Computer Science P2',
} as const;

export type IgcseSubjectKey = keyof typeof IGCSE_SUBJECTS;
export type IgcseSubject = (typeof IGCSE_SUBJECTS)[IgcseSubjectKey];

// --- Question Types ---
export interface McqQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface SourcedMcqQuestion extends McqQuestion {
  sourcePaper: string;
  sourceUrl: string;
}

export interface TrueFalseQuestion {
  statement: string;
  answer: boolean; // true or false
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface PastPaperQuestion {
  question: string;
  answer: string;
  difficulty: Difficulty;
}

export type GeneratedContent =
  | { type: 'brief-summary'; content: string }
  | { type: 'detailed-summary'; content: string }
  | { type: 'mcqs'; content: McqQuestion[] }
  | { type: 'true-false'; content: TrueFalseQuestion[] }
  | { type: 'past-papers'; content: PastPaperQuestion[] }
  | { type: 'sourced-mcqs'; content: SourcedMcqQuestion[] };

export interface SavedPastPapers {
  [subject: string]: PastPaperQuestion[];
}

export interface SavedNote {
  id: string;
  title: string;
  subject: IgcseSubject | null;
  content: string;
  date: string; // ISO string
}

// --- Hurry Study Types ---

export interface HurryStudyTopic {
  id: string;
  name: string;
}

export interface TheoryQuestion {
  id: number;
  question: string;
  type: 'easy' | 'hard';
}

export interface QuestionFeedback {
  questionId: number;
  score: number;
  maxScore: number;
  feedback: string;
  modelAnswer: string;
}

export interface TheoryGradingResult {
  totalScore: number;
  maxTotalScore: number;
  feedbacks: QuestionFeedback[];
  generalAdvice: string;
}
