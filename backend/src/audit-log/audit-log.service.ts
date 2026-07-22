import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RecordAuditLogParams {
  cooperativeId?: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(params: RecordAuditLogParams) {
    return this.prisma.auditLog.create({ data: params });
  }

  listForCooperative(cooperativeId: string) {
    return this.prisma.auditLog.findMany({
      where: { cooperativeId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
