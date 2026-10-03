-- index สำหรับประวัติการเล่นของผู้ใช้ และรายการรายงานของผู้เปิดห้อง

-- CreateIndex
CREATE INDEX "game_sessions_host_core_user_id_status_finished_at_idx" ON "game_sessions"("host_core_user_id", "status", "finished_at");

-- CreateIndex
CREATE INDEX "game_players_core_user_id_idx" ON "game_players"("core_user_id");
