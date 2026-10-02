import { afterEach, describe, expect, it, vi } from "vitest";
import { listRecentReports } from "@/lib/report-store";

afterEach(() => vi.unstubAllGlobals());

describe("listRecentReports", () => {
  it("ขอหน้าแรกตามจำนวนที่ต้องการ และแปลงชื่อ field ให้หน้าเว็บ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: "g1",
              quizId: "q1",
              quizTitle: "ความรู้ทั่วไป",
              gamePin: "123456",
              playerCount: 12,
              questionCount: 5,
              averageAccuracy: 64.5,
              topScore: 4200,
              startedAt: "2026-09-30T10:00:00.000Z",
              finishedAt: "2026-09-30T10:10:00.000Z",
            },
          ],
          meta: { total: 1, page: 1, limit: 3, totalPages: 1 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const list = await listRecentReports(3);

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/game-reports?page=1&limit=3");
    expect(list).toEqual([
      expect.objectContaining({
        id: "g1",
        sessionId: "g1",
        quizTitle: "ความรู้ทั่วไป",
        totalPlayers: 12,
        totalQuestions: 5,
        averageAccuracy: 64.5,
      }),
    ]);
  });
});
