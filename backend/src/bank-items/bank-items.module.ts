import { Module } from '@nestjs/common';
import { BankItemsController } from './bank-items.controller';
import { BankItemsService } from './bank-items.service';

@Module({ controllers: [BankItemsController], providers: [BankItemsService] })
export class BankItemsModule {}
