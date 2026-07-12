import { Module } from "@nestjs/common";
import { UserModule } from "../user/user.module";
import { TransactionModule } from "../transaction/transaction.module";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";

@Module({
  imports: [UserModule, TransactionModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
