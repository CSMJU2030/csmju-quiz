import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Errors } from '../common/app-exception';
import { Paginated } from '../common/envelope';
import { iso } from '../common/iso';
import type { BankItem, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTags, type QuestionContentDto } from '../questions/question-input.dto';
import { questionIssues, TRUE_FALSE_TEXTS } from '../questions/question-rules';
import type {
  BankItemQueryDto,
  BankItemView,
  CreateBankItemDto,
  UpdateBankItemDto,
} from './bank-item.dto';

interface StoredOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

function readOptions(value: Prisma.JsonValue): StoredOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return [];
    const r = o as Record<string, unknown>;
    return typeof r.id === 'string' && typeof r.text === 'string'
      ? [{ id: r.id, text: r.text, isCorrect: r.isCorrect === true }]
      : [];
  });
}

function toView(item: BankItem): BankItemView {
  return {
    id: item.id,
    ownerCoreUserId: item.ownerCoreUserId,
    type: item.type,
    prompt: item.prompt,
    imageUrl: item.imageUrl,
    timeLimit: item.timeLimit,
    points: item.points,
    tags: item.tags,
    difficulty: item.difficulty,
    usedCount: item.usedCount,
    options: readOptions(item.options),
    createdAt: iso(item.createdAt)!,
    updatedAt: iso(item.updatedAt)!,
  };
}

@Injectable()
export class BankItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: CoreHubIdentity, q: BankItemQueryDto) {
    const where: Prisma.BankItemWhereInput = {
      ownerCoreUserId: user.coreUserId,
      ...(q.search ? { prompt: { contains: q.search, mode: 'insensitive' } } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
      ...(q.difficulty ? { difficulty: q.difficulty } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.bankItem.count({ where }),
      this.prisma.bankItem.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return Paginated.of(rows.map(toView), total, q.page, q.limit);
  }

  async findOne(user: CoreHubIdentity, id: string) {
    return toView(await this.load(user, id));
  }

  async create(user: CoreHubIdentity, dto: CreateBankItemDto) {
    const content = this.prepare(dto);
    const item = await this.prisma.bankItem.create({
      data: { ownerCoreUserId: user.coreUserId, ...content },
    });
    return toView(item);
  }

  async update(user: CoreHubIdentity, id: string, dto: UpdateBankItemDto) {
    const current = await this.load(user, id);
    const merged: QuestionContentDto = {
      type: dto.type ?? current.type,
      prompt: dto.prompt ?? current.prompt,
      imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : current.imageUrl,
      timeLimit: dto.timeLimit ?? current.timeLimit,
      points: dto.points ?? current.points,
      tags: dto.tags ?? current.tags,
      difficulty: dto.difficulty ?? current.difficulty,
      options: dto.options ?? readOptions(current.options),
    };
    const item = await this.prisma.bankItem.update({ where: { id }, data: this.prepare(merged) });
    return toView(item);
  }

  async remove(user: CoreHubIdentity, id: string) {
    await this.load(user, id);
    await this.prisma.bankItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async load(user: CoreHubIdentity, id: string) {
    const item = await this.prisma.bankItem.findUnique({ where: { id } });
    if (!item) throw Errors.notFound('Bank item');
    if (item.ownerCoreUserId !== user.coreUserId) throw Errors.forbidden();
    return item;
  }

  private prepare(dto: QuestionContentDto) {
    const options: StoredOption[] = dto.options.map((o, i) => ({
      id: o.id ?? randomUUID(),
      text: dto.type === 'TRUE_FALSE' ? (TRUE_FALSE_TEXTS[i] ?? o.text) : o.text,
      isCorrect: o.isCorrect,
    }));
    const issues = questionIssues({
      type: dto.type,
      prompt: dto.prompt,
      imageUrl: dto.imageUrl,
      options,
    });
    if (issues.length) throw Errors.validation(issues);
    return {
      type: dto.type,
      prompt: dto.prompt,
      imageUrl: dto.imageUrl ?? null,
      timeLimit: dto.timeLimit,
      points: dto.points,
      tags: normalizeTags(dto.tags),
      difficulty: dto.difficulty ?? 'MEDIUM',
      options: options as unknown as Prisma.InputJsonValue,
    };
  }
}
