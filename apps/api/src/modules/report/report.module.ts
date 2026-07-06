import { Module } from "@nestjs/common";
import { UserModule } from "../user/user.module";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";

@Module({
  imports: [UserModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
