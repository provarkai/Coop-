import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CooperativesModule } from './cooperatives/cooperatives.module';
import { ComplianceModule } from './compliance/compliance.module';
import { SavingsModule } from './savings/savings.module';
import { LoansModule } from './loans/loans.module';
import { PaymentsModule } from './payments/payments.module';
import { AccountingModule } from './accounting/accounting.module';
import { MeetingsModule } from './meetings/meetings.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { AiModule } from './ai/ai.module';
import { ContributionsModule } from './contributions/contributions.module';
import { LandBankingModule } from './land-banking/land-banking.module';
import { SyndicationModule } from './syndication/syndication.module';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // A cooperative page load fans out into a dozen-plus parallel API calls
    // (dashboard, trends, documents, notifications, meetings, ...), so the
    // general default needs headroom well above a single request's worth;
    // brute-force-sensitive auth routes get their own tighter @Throttle().
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    CooperativesModule,
    ComplianceModule,
    SavingsModule,
    LoansModule,
    PaymentsModule,
    AccountingModule,
    MeetingsModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    AiModule,
    ContributionsModule,
    LandBankingModule,
    SyndicationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
