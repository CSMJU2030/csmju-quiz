// src/lib/api-types.ts
// ชื่อสั้นของ type ที่ generate จาก backend/openapi.json (tech-stack.md ข้อ 3)
// ห้ามเขียน type ของ API response เอง — แก้ backend แล้วรัน `pnpm generate:api` ที่ราก repo

import type { components } from "@/types/api";

type Schemas = components["schemas"];

export type MeView = Schemas["MeDto"];

export type QuizView = Schemas["QuizView"];
export type QuizSummaryView = Schemas["QuizSummaryView"];
export type QuestionView = Schemas["QuestionView"];
export type UpdateQuizBody = Schemas["UpdateQuizDto"];
export type QuestionInputBody = Schemas["QuestionInputDto"];

export type BankItemView = Schemas["BankItemView"];
export type CreateBankItemBody = Schemas["CreateBankItemDto"];

export type GameStateView = Schemas["GameStateView"];
export type GamePlayerView = Schemas["GamePlayerView"];
export type GameQuestionView = Schemas["GameQuestionView"];
export type GameOptionView = Schemas["GameOptionView"];
export type GameMeView = Schemas["GameMeView"];
export type GameJoinView = Schemas["GameJoinView"];
export type GameLobbyView = Schemas["GameLobbyView"];
export type GameSessionSummaryView = Schemas["GameSessionSummaryView"];
export type CreateGameSessionBody = Schemas["CreateGameSessionDto"];
export type PodiumResultsView = Schemas["PodiumResultsView"];
export type PodiumAwardView = Schemas["PodiumAwardView"];

export type GameReportView = Schemas["GameReportView"];
export type GameReportSummaryView = Schemas["GameReportSummaryView"];

export type PlayerGameResultView = Schemas["PlayerGameResultView"];
/** แถวในประวัติการเล่นของฉัน (รูปแบบเดียวกับผลของผู้เล่นในรายงาน) */
export type GameHistorySummaryView = PlayerGameResultView;
export type PlayerGameReviewView = Schemas["PlayerGameReviewView"];
export type PlayerStatsView = Schemas["PlayerStatsView"];
export type AnswerReviewView = Schemas["AnswerReviewView"];
