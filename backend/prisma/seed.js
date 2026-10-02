// ข้อมูลตัวอย่างสำหรับเครื่องพัฒนา — แบบทดสอบ 1 ชุดของบัญชี dev staff (user-003)
// รัน: pnpm run prisma:seed  (ต้อง build ก่อน เพราะใช้ Prisma client ใน dist/)
'use strict';
require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

const OWNER = process.env.SEED_OWNER_CORE_USER_ID || 'user-003';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('ห้าม seed บน production');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const exists = await prisma.quiz.count({ where: { ownerCoreUserId: OWNER, title: 'ความรู้พื้นฐานคอมพิวเตอร์' } });
    if (exists) return console.log('seed: มีข้อมูลตัวอย่างแล้ว ข้าม');
    await prisma.quiz.create({
      data: {
        ownerCoreUserId: OWNER,
        title: 'ความรู้พื้นฐานคอมพิวเตอร์',
        description: 'แบบทดสอบตัวอย่างสำหรับทดลองระบบ',
        status: 'PUBLISHED',
        questions: {
          create: [
            {
              position: 1,
              type: 'MULTIPLE_CHOICE',
              prompt: 'ข้อใดคืออุปกรณ์ประมวลผลหลักของคอมพิวเตอร์',
              timeLimit: 20,
              points: 1000,
              tags: ['ฮาร์ดแวร์'],
              options: {
                create: ['RAM', 'CPU', 'Hard Disk', 'GPU'].map((text, i) => ({
                  position: i + 1,
                  text,
                  isCorrect: text === 'CPU',
                })),
              },
            },
            {
              position: 2,
              type: 'TRUE_FALSE',
              prompt: 'IPv4 มีขนาด 32 บิต',
              timeLimit: 15,
              points: 1000,
              tags: ['เครือข่าย'],
              options: { create: [{ position: 1, text: 'ถูก', isCorrect: true }, { position: 2, text: 'ผิด', isCorrect: false }] },
            },
          ],
        },
      },
    });
    console.log(`seed: สร้างแบบทดสอบตัวอย่างให้ ${OWNER} แล้ว`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
