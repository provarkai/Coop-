import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import { MANAGE_GOVERNANCE_ROLES } from '../cooperatives/roles.constants';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/documents')
  upload(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documents.upload(id, actor, dto);
  }

  @Get(':id/documents')
  list(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.list(id, user);
  }

  @Get(':id/documents/:documentId')
  async download(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const document = await this.documents.getForDownload(id, documentId, user);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.fileName}"`,
    );
    res.send(document.content);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/documents/:documentId')
  async remove(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.documents.remove(id, documentId, actor);
  }
}
