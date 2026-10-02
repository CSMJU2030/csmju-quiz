import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { UuidParam } from '../common/uuid.pipe';
import { CreateQuizDto, QuizQueryDto, QuizSummaryView, QuizView, UpdateQuizDto } from './quiz.dto';
import { QuizzesService } from './quizzes.service';
import { SESSION_COOKIE } from '../auth/token-extractor';

@ApiTags('quizzes')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@Controller('v1/quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  @RequirePermissions(Permission.QUIZ_READ_OWN, Permission.QUIZ_READ_ANY)
  @ApiOperation({ summary: 'List quizzes (own; ADMIN sees all)' })
  @ApiOkResponse({ type: [QuizSummaryView] })
  list(@CurrentUser() user: CoreHubIdentity, @Query() query: QuizQueryDto) {
    return this.quizzes.list(user, query);
  }

  @Post()
  @RequirePermissions(Permission.QUIZ_MANAGE_OWN)
  @ApiOperation({ summary: 'Create a draft quiz' })
  @ApiCreatedResponse({ type: QuizView })
  create(@CurrentUser() user: CoreHubIdentity, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.QUIZ_READ_OWN, Permission.QUIZ_READ_ANY)
  @ApiOperation({ summary: 'Get a quiz with its questions' })
  @ApiOkResponse({ type: QuizView })
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.quizzes.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.QUIZ_MANAGE_OWN, Permission.QUIZ_MANAGE_ANY)
  @ApiOperation({ summary: 'Update title/description/status and/or replace all questions' })
  @ApiOkResponse({ type: QuizView })
  update(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.QUIZ_MANAGE_OWN, Permission.QUIZ_MANAGE_ANY)
  @ApiOperation({ summary: 'Delete a quiz (played games and reports are kept)' })
  remove(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.quizzes.remove(user, id);
  }

  @Post(':id/copies')
  @HttpCode(201)
  @RequirePermissions(Permission.QUIZ_MANAGE_OWN)
  @ApiOperation({ summary: 'Copy a quiz into a new draft owned by the caller' })
  @ApiCreatedResponse({ type: QuizView })
  copy(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.quizzes.copy(user, id);
  }
}
