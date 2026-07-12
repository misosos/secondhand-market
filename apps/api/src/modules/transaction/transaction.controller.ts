import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PurchaseDto } from "./dto/purchase.dto";
import { TransactionListQueryDto } from "./dto/transaction-list-query.dto";
import { TransactionService } from "./transaction.service";

@Controller("transactions")
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  purchase(@CurrentUser("sub") buyerId: string, @Body() dto: PurchaseDto) {
    return this.transactionService.purchase(buyerId, dto.productId);
  }

  @Get("mine")
  listMine(@CurrentUser("sub") userId: string, @Query() query: TransactionListQueryDto) {
    return this.transactionService.listMine(userId, query.cursor, query.limit);
  }
}
