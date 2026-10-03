import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import {
  BankItemQueryDto,
  BankItemView,
  CreateBankItemDto,
  UpdateBankItemDto,
} from './bank-item.dto';
import { BankItemsService } from './bank-items.service';
import { SESSION_COOKIE } from '../auth/token-extractor';

@ApiTags('bank-items')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@RequirePermissions(Permission.QUESTION_BANK_MANAGE_OWN)
@Controller('v1/bank-items')
export class BankItemsController {
  constructor(private readonly items: BankItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List my question bank items' })
  @ApiOkResponse({ type: [BankItemView] })
  list(@CurrentUser() user: CoreHubIdentity, @Query() query: BankItemQueryDto) {
    return this.items.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a complete question to my bank' })
  @ApiCreatedResponse({ type: BankItemView })
  create(@CurrentUser() user: CoreHubIdentity, @Body() dto: CreateBankItemDto) {
    return this.items.create(user, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: BankItemView })
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.items.findOne(user, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: BankItemView })
  update(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateBankItemDto,
  ) {
    return this.items.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete from bank (quiz copies are kept)' })
  remove(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.items.remove(user, id);
  }
}
