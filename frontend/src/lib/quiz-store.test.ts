import { describe, expect, it } from "vitest";
import type { QuizView } from "@/lib/api-types";
import { toQuestionInput, toQuiz } from "@/lib/quiz-store";

const view: QuizView = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerCoreUserId: "user-003",
  title: "Quiz",
  description: "",
  status: "DRAFT",
  version: 2,
  questionCount: 2,
  incompleteCount: 0,
  totalTimeLimit: 40,
  createdAt: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-09-30T00:00:00.000Z",
  questions: [
    {
      id: "q2",
      quizId: "x",
      order: 2,
      type: "TRUE_FALSE",
      prompt: "B",
      imageUrl: null,
      timeLimit: 10,
      points: 0,
      tags: [],
      difficulty: "EASY",
      sourceBankItemId: null,
      options: [
        { id: "t", text: "ถูก", isCorrect: true },
        { id: "f", text: "ผิด", isCorrect: false },
      ],
      issues: [],
    },
    {
      id: "q1",
      quizId: "x",
      order: 1,
      type: "MULTIPLE_CHOICE",
      prompt: "A",
      imageUrl: "https://example.com/a.png",
      timeLimit: 20,
      points: 1000,
      tags: ["x"],
      difficulty: "MEDIUM",
      sourceBankItemId: "22222222-2222-4222-8222-222222222222",
      options: [
        { id: "o1", text: "1", isCorrect: false },
        { id: "o2", text: "2", isCorrect: true },
      ],
      issues: [],
    },
  ],
};

describe("quiz-store mapping", () => {
  it("เรียงคำถามตามลำดับ และแปลง imageUrl → image", () => {
    const quiz = toQuiz(view);
    expect(quiz.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(quiz.questions[0].image).toBe("https://example.com/a.png");
    expect(quiz.questions[1].image).toBeUndefined();
  });

  it("ส่งกลับ backend ด้วยชื่อ field ตามสัญญา", () => {
    const body = toQuestionInput(toQuiz(view).questions[0]);
    expect(body).toMatchObject({
      id: "q1",
      type: "MULTIPLE_CHOICE",
      imageUrl: "https://example.com/a.png",
      sourceBankItemId: "22222222-2222-4222-8222-222222222222",
      options: [
        { text: "1", isCorrect: false },
        { text: "2", isCorrect: true },
      ],
    });
  });
});
