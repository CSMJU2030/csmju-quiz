-- รูปที่อัปโหลดผ่านบริการเก็บรูปของ Core Hub — เก็บแค่ id (reference-data.md ข้อ 6 และ 8)
-- image_url ยังใช้กับลิงก์รูป https:// ที่ผู้สอนวางเอง · มีค่าได้อย่างใดอย่างหนึ่ง
ALTER TABLE "questions" ADD COLUMN "image_id" UUID;
ALTER TABLE "bank_items" ADD COLUMN "image_id" UUID;
