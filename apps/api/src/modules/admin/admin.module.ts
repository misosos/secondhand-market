import { Module } from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin.guard";
import { UserModule } from "../user/user.module";
import { TransactionModule } from "../transaction/transaction.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [UserModule, TransactionModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
