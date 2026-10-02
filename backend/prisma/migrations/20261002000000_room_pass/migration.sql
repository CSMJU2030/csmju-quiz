-- บัตรเข้าห้องของผู้เล่นที่ไม่ล็อกอิน (PM อนุมัติ 2 ต.ค. 2569)
-- เก็บเฉพาะ sha256 ของบัตร · ผู้เล่นแบบนี้ไม่มี core_user_id

-- AlterTable
ALTER TABLE "game_players" ADD COLUMN     "room_pass_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "room_pass_hash" CHAR(64),
ALTER COLUMN "core_user_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "game_players_room_pass_hash_key" ON "game_players"("room_pass_hash");
