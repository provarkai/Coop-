import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import {
  MANAGE_LOAN_ROLES,
  VIEW_LOAN_ROLES,
} from '../cooperatives/roles.constants';
import { LoansService } from './loans.service';
import { CreateLoanProductDto } from './dto/create-loan-product.dto';
import { UpdateLoanProductDto } from './dto/update-loan-product.dto';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { AddLoanGuarantorDto } from './dto/add-loan-guarantor.dto';
import { RespondLoanGuarantorDto } from './dto/respond-loan-guarantor.dto';
import { RecordRepaymentDto } from './dto/record-repayment.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Post(':id/loan-products')
  createProduct(@Param('id') id: string, @Body() dto: CreateLoanProductDto) {
    return this.loans.createProduct(id, dto);
  }

  @Get(':id/loan-products')
  listProducts(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loans.listProducts(id, user);
  }

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Patch(':id/loan-products/:productId')
  updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateLoanProductDto,
  ) {
    return this.loans.updateProduct(id, productId, dto);
  }

  @Post(':id/loans')
  apply(
    @Param('id') id: string,
    @CurrentUser() applicant: AuthenticatedUser,
    @Body() dto: ApplyLoanDto,
  ) {
    return this.loans.apply(id, applicant, dto);
  }

  @CooperativeRoles(...VIEW_LOAN_ROLES)
  @Get(':id/loans')
  listLoansForCooperative(@Param('id') id: string) {
    return this.loans.listLoansForCooperative(id);
  }

  @Get(':id/loan-guarantor-requests')
  listGuarantorRequestsForUser(
    @Param('id') id: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.loans.listGuarantorRequestsForUser(id, requester);
  }

  @Get(':id/members/:userId/loans')
  listLoansForMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.loans.listLoansForMember(id, userId, requester);
  }

  @Get(':id/loans/:loanId')
  getLoan(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.loans.getLoan(id, loanId, requester);
  }

  @Post(':id/loans/:loanId/guarantors')
  addGuarantor(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: AddLoanGuarantorDto,
  ) {
    return this.loans.addGuarantor(id, loanId, requester, dto);
  }

  @Get(':id/loans/:loanId/guarantors')
  listGuarantors(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.loans.listGuarantors(id, loanId, requester);
  }

  @Patch(':id/loans/:loanId/guarantors/:guarantorId/respond')
  respondToGuarantorRequest(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @Param('guarantorId') guarantorId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: RespondLoanGuarantorDto,
  ) {
    return this.loans.respondToGuarantorRequest(
      id,
      loanId,
      guarantorId,
      requester,
      dto,
    );
  }

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Post(':id/loans/:loanId/approve')
  approve(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loans.approve(id, loanId, actor);
  }

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Post(':id/loans/:loanId/reject')
  reject(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @Body() dto: RejectLoanDto,
  ) {
    return this.loans.reject(id, loanId, dto);
  }

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Post(':id/loans/:loanId/disburse')
  disburse(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loans.disburse(id, loanId, actor);
  }

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Post(':id/loans/:loanId/repayments')
  recordRepayment(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordRepaymentDto,
  ) {
    return this.loans.recordRepayment(id, loanId, actor, dto);
  }

  @CooperativeRoles(...MANAGE_LOAN_ROLES)
  @Post(':id/loans/:loanId/assess-penalty')
  assessPenalty(
    @Param('id') id: string,
    @Param('loanId') loanId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loans.assessPenalty(id, loanId, actor);
  }
}
