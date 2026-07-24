import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateDocumentDto } from './dto/create-document.dto';

const DOCUMENT_METADATA_SELECT = {
  id: true,
  cooperativeId: true,
  uploadedByUserId: true,
  title: true,
  category: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
  ) {}

  async upload(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: CreateDocumentDto,
  ) {
    const content = Buffer.from(dto.contentBase64, 'base64');
    const document = await this.prisma.document.create({
      data: {
        cooperativeId,
        uploadedByUserId: actor.userId,
        title: dto.title,
        category: dto.category,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: content.length,
        content,
      },
      select: DOCUMENT_METADATA_SELECT,
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'document.uploaded',
      targetType: 'Document',
      targetId: document.id,
      metadata: { title: document.title, fileName: document.fileName },
    });

    return document;
  }

  async list(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.document.findMany({
      where: { cooperativeId },
      select: DOCUMENT_METADATA_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForDownload(
    cooperativeId: string,
    documentId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertMember(cooperativeId, user);
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async remove(
    cooperativeId: string,
    documentId: string,
    actor: AuthenticatedUser,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Document not found');
    }
    await this.prisma.document.delete({ where: { id: documentId } });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'document.deleted',
      targetType: 'Document',
      targetId: documentId,
      metadata: { title: document.title },
    });
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }
    if (user.role === Role.REGULATOR) {
      const assigned = await this.regulatorAssignments.isAssigned(
        user.userId,
        cooperativeId,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'You are not assigned to this cooperative',
        );
      }
      return;
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
  }
}
