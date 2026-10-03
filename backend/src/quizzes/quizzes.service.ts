import { Injectable } from '@nestjs/common';
import { Errors } from '../common/app-exception';
import { Paginated } from '../common/envelope';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTags, type QuestionInputDto } from '../questions/question-input.dto';
import { questionIssues, TRUE_FALSE_TEXTS } from '../questions/question-rules';
import type { CreateQuizDto, QuizQueryDto, UpdateQuizDto } from './quiz.dto';
import { toQuizSummary, toQuizView } from './quiz.mapper';

const WITH_QUESTIONS = {
  questions: {
    orderBy: { position: 'asc' },
    include: { options: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;

type QuizWithQuestions = Prisma.QuizGetPayload<{ include: typeof WITH_QUESTIONS }>;

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  /* ─────────── อ่าน ─────────── */

  async list(user: CoreHubIdentity, q: QuizQueryDto) {
    const where: Prisma.QuizWhereInput = {
      ...(user.permissions.includes(Permission.QUIZ_READ_ANY)
        ? {}
        : { ownerCoreUserId: user.coreUserId }),
      ...(q.status === 'ACTIVE'
        ? { status: { in: ['DRAFT', 'PUBLISHED'] } }
        : q.status
          ? { status: q.status }
          : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortField = q.sort ?? 'updatedAt';
    const orderBy: Prisma.QuizOrderByWithRelationInput[] = [
      sortField === 'title'
        ? { title: 'asc' }
        : sortField === 'questionCount'
          ? { questions: { _count: 'desc' } }
          : { [sortField]: 'desc' },
      { id: 'asc' }, // ลำดับคงที่เสมอ
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quiz.count({ where }),
      this.prisma.quiz.findMany({
        where,
        orderBy,
        skip: q.skip,
        take: q.limit,
        include: WITH_QUESTIONS,
      }),
    ]);
    return Paginated.of(rows.map(toQuizSummary), total, q.page, q.limit);
  }

  async findOne(user: CoreHubIdentity, id: string) {
    return toQuizView(await this.loadReadable(user, id));
  }

  /* ─────────── เขียน ─────────── */

  async create(user: CoreHubIdentity, dto: CreateQuizDto) {
    const quiz = await this.prisma.quiz.create({
      data: {
        ownerCoreUserId: user.coreUserId,
        title: dto.title,
        description: dto.description ?? '',
      },
      include: WITH_QUESTIONS,
    });
    return toQuizView(quiz);
  }

  async update(user: CoreHubIdentity, id: string, dto: UpdateQuizDto) {
    const current = await this.loadManageable(user, id);
    const nextStatus = dto.status ?? current.status;

    // ตรวจความครบกับชุดคำถามที่จะเป็นหลังบันทึก
    const futureQuestions = dto.questions
      ? dto.questions.map((q) => ({ ...q, options: this.normalizeOptions(q) }))
      : current.questions.map((q) => ({ ...q, options: q.options }));
    if (nextStatus === 'PUBLISHED') this.assertPublishable(futureQuestions);

    const saved = await this.prisma.$transaction(async (tx) => {
      if (dto.questions) await this.replaceQuestions(tx, user, current, dto.questions);
      return tx.quiz.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          status: nextStatus,
          version: { increment: 1 },
        },
        include: WITH_QUESTIONS,
      });
    });
    return toQuizView(saved);
  }

  async remove(user: CoreHubIdentity, id: string) {
    await this.loadManageable(user, id);
    await this.prisma.quiz.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** ทำสำเนาเป็นแบบร่างใหม่ของผู้เรียก */
  async copy(user: CoreHubIdentity, id: string) {
    const source = await this.loadReadable(user, id);
    const created = await this.prisma.quiz.create({
      data: {
        ownerCoreUserId: user.coreUserId,
        title: `${source.title} (สำเนา)`.slice(0, 150),
        description: source.description,
        questions: {
          create: source.questions.map((q) => ({
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            imageUrl: q.imageUrl,
            timeLimit: q.timeLimit,
            points: q.points,
            tags: q.tags,
            difficulty: q.difficulty,
            sourceBankItemId: q.sourceBankItemId,
            options: {
              create: q.options.map((o) => ({
                position: o.position,
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            },
          })),
        },
      },
      include: WITH_QUESTIONS,
    });
    return toQuizView(created);
  }

  /* ─────────── ใช้ภายใน ─────────── */

  /** ไม่พบ → 404 · ไม่ใช่เจ้าของและไม่มีสิทธิ์ :any → 403 */
  async loadReadable(user: CoreHubIdentity, id: string): Promise<QuizWithQuestions> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: WITH_QUESTIONS });
    if (!quiz) throw Errors.notFound('Quiz');
    const own = quiz.ownerCoreUserId === user.coreUserId;
    if (!own && !user.permissions.includes(Permission.QUIZ_READ_ANY)) throw Errors.forbidden();
    return quiz;
  }

  private async loadManageable(user: CoreHubIdentity, id: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: WITH_QUESTIONS });
    if (!quiz) throw Errors.notFound('Quiz');
    const own = quiz.ownerCoreUserId === user.coreUserId;
    if (!own && !user.permissions.includes(Permission.QUIZ_MANAGE_ANY)) throw Errors.forbidden();
    return quiz;
  }

  private normalizeOptions(q: QuestionInputDto) {
    // ถูก/ผิด ใช้ข้อความคงที่เสมอ (กันข้อความแปลก ๆ จาก client)
    if (q.type === 'TRUE_FALSE') {
      return q.options.slice(0, 2).map((o, i) => ({ ...o, text: TRUE_FALSE_TEXTS[i] ?? o.text }));
    }
    return q.options;
  }

  private assertPublishable(questions: Parameters<typeof questionIssues>[0][]) {
    if (questions.length === 0) {
      throw Errors.conflict('Quiz needs at least one question before publishing');
    }
    const details = questions.flatMap((q, i) =>
      questionIssues(q).map((m) => `questions[${i}]: ${m}`),
    );
    if (details.length) throw Errors.conflict('Quiz has incomplete questions', details);
  }

  private async replaceQuestions(
    tx: Prisma.TransactionClient,
    user: CoreHubIdentity,
    current: QuizWithQuestions,
    inputs: QuestionInputDto[],
  ) {
    // นับการใช้คำถามจากคลังเฉพาะที่เพิ่งถูกเพิ่มเข้าแบบทดสอบนี้
    const before = new Set(current.questions.map((q) => q.sourceBankItemId).filter(Boolean));
    const newlyUsed = [
      ...new Set(
        inputs.map((q) => q.sourceBankItemId).filter((s): s is string => !!s && !before.has(s)),
      ),
    ];

    // แทนที่ทั้งชุด — คง id เดิมถ้า client ส่งมาและเป็นของแบบทดสอบนี้
    const ownIds = new Set(current.questions.map((q) => q.id));
    await tx.question.deleteMany({ where: { quizId: current.id } });
    for (const [index, q] of inputs.entries()) {
      const options = this.normalizeOptions(q);
      await tx.question.create({
        data: {
          ...(q.id && ownIds.has(q.id) ? { id: q.id } : {}),
          quizId: current.id,
          position: index + 1,
          type: q.type,
          prompt: q.prompt,
          imageUrl: q.imageUrl ?? null,
          timeLimit: q.timeLimit,
          points: q.points,
          tags: normalizeTags(q.tags),
          difficulty: q.difficulty ?? 'MEDIUM',
          sourceBankItemId: q.sourceBankItemId ?? null,
          options: {
            create: options.map((o, i) => ({
              position: i + 1,
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          },
        },
      });
    }

    if (newlyUsed.length) {
      await tx.bankItem.updateMany({
        where: { id: { in: newlyUsed }, ownerCoreUserId: user.coreUserId },
        data: { usedCount: { increment: 1 } },
      });
    }
  }
}
