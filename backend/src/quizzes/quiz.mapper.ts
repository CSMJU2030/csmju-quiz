import { iso } from '../common/iso';
import { displayImageUrl } from '../images/image-url';
import { questionIssues } from '../questions/question-rules';
import type { QuestionView } from '../questions/question.view';
import type { QuizSummaryView, QuizView } from './quiz.dto';

type OptionRow = { id: string; text: string; isCorrect: boolean; position: number };
type QuestionRow = {
  id: string;
  quizId: string;
  position: number;
  type: string;
  prompt: string;
  imageUrl: string | null;
  imageId: string | null;
  timeLimit: number;
  points: number;
  tags: string[];
  difficulty: string;
  sourceBankItemId: string | null;
  options: OptionRow[];
};
type QuizRow = {
  id: string;
  ownerCoreUserId: string;
  title: string;
  description: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  questions: QuestionRow[];
};

export function toQuestionView(q: QuestionRow): QuestionView {
  const options = [...q.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));
  return {
    id: q.id,
    quizId: q.quizId,
    order: q.position,
    type: q.type,
    prompt: q.prompt,
    imageUrl: displayImageUrl(q),
    imageId: q.imageId,
    timeLimit: q.timeLimit,
    points: q.points,
    tags: q.tags,
    difficulty: q.difficulty,
    sourceBankItemId: q.sourceBankItemId,
    options,
    issues: questionIssues({ type: q.type, prompt: q.prompt, imageUrl: q.imageUrl, options }),
  };
}

export function toQuizSummary(quiz: QuizRow): QuizSummaryView {
  const questions = quiz.questions.map(toQuestionView);
  return {
    id: quiz.id,
    ownerCoreUserId: quiz.ownerCoreUserId,
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    version: quiz.version,
    questionCount: questions.length,
    incompleteCount: questions.filter((q) => q.issues.length > 0).length,
    totalTimeLimit: questions.reduce((sum, q) => sum + q.timeLimit, 0),
    createdAt: iso(quiz.createdAt)!,
    updatedAt: iso(quiz.updatedAt)!,
  };
}

export function toQuizView(quiz: QuizRow): QuizView {
  return {
    ...toQuizSummary(quiz),
    questions: [...quiz.questions].sort((a, b) => a.position - b.position).map(toQuestionView),
  };
}
