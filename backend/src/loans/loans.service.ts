import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuarantorStatus,
  LoanLedgerEntryType,
  LoanStatus,
  MembershipStatus,
  Prisma,
  RepaymentInstallmentStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VIEW_LOAN_ROLES } from '../cooperatives/roles.constants';
import { CreateLoanProductDto } from './dto/create-loan-product.dto';
import { UpdateLoanProductDto } from './dto/update-loan-product.dto';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { AddLoanGuarantorDto } from './dto/add-loan-guarantor.dto';
import { RespondLoanGuarantorDto } from './dto/respond-loan-guarantor.dto';
import { RecordRepaymentDto } from './dto/record-repayment.dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async createProduct(cooperativeId: string, dto: CreateLoanProductDto) {
    const existing = await this.prisma.loanProduct.findUnique({
      where: { cooperativeId_code: { cooperativeId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException(
        'A loan product with this code already exists',
      );
    }
    return this.prisma.loanProduct.create({
      data: {
        cooperativeId,
        name: dto.name,
        code: dto.code,
        interestRatePercent: dto.interestRatePercent ?? 0,
        maxAmount: dto.maxAmount,
        maxTermMonths: dto.maxTermMonths,
        penaltyRatePercent: dto.penaltyRatePercent ?? 0,
        requiredGuarantors: dto.requiredGuarantors ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listProducts(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.loanProduct.findMany({
      where: { cooperativeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateProduct(
    cooperativeId: string,
    productId: string,
    dto: UpdateLoanProductDto,
  ) {
    const product = await this.getProductOrThrow(cooperativeId, productId);
    return this.prisma.loanProduct.update({
      where: { id: product.id },
      data: dto,
    });
  }

  async apply(
    cooperativeId: string,
    applicant: AuthenticatedUser,
    dto: ApplyLoanDto,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: {
        cooperativeId_userId: { cooperativeId, userId: applicant.userId },
      },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException('You are not an active cooperative member');
    }

    const product = await this.getProductOrThrow(cooperativeId, dto.productId);
    if (!product.isActive) {
      throw new BadRequestException('This loan product is not active');
    }
    if (new Prisma.Decimal(dto.principal).greaterThan(product.maxAmount)) {
      throw new BadRequestException(
        "Principal exceeds this product's maximum amount",
      );
    }
    if (dto.termMonths > product.maxTermMonths) {
      throw new BadRequestException("Term exceeds this product's maximum term");
    }

    return this.prisma.loan.create({
      data: {
        cooperativeId,
        membershipId: membership.id,
        productId: product.id,
        principal: dto.principal,
        interestRatePercent: product.interestRatePercent,
        termMonths: dto.termMonths,
      },
    });
  }

  async listLoansForCooperative(cooperativeId: string) {
    return this.prisma.loan.findMany({
      where: { cooperativeId },
      include: {
        product: true,
        membership: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listLoansForMember(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrViewRole(cooperativeId, userId, requester);
    return this.prisma.loan.findMany({
      where: { cooperativeId, membership: { userId } },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listGuarantorRequestsForUser(
    cooperativeId: string,
    requester: AuthenticatedUser,
  ) {
    return this.prisma.loanGuarantor.findMany({
      where: { guarantorUserId: requester.userId, loan: { cooperativeId } },
      include: {
        loan: {
          include: {
            membership: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLoan(
    cooperativeId: string,
    loanId: string,
    requester: AuthenticatedUser,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    await this.assertCanViewLoan(
      cooperativeId,
      loanId,
      loan.membership.userId,
      requester,
    );
    return this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        product: true,
        membership: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        guarantors: {
          include: {
            guarantorUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        schedule: { orderBy: { installmentNumber: 'asc' } },
        ledger: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async addGuarantor(
    cooperativeId: string,
    loanId: string,
    requester: AuthenticatedUser,
    dto: AddLoanGuarantorDto,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    if (loan.membership.userId !== requester.userId) {
      throw new ForbiddenException(
        'Only the borrower can nominate guarantors for this loan',
      );
    }
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        'Guarantors can only be nominated while the loan is pending',
      );
    }

    const guarantorUser = await this.users.findByEmail(dto.email);
    if (!guarantorUser) {
      throw new NotFoundException('No user with that email is registered');
    }
    if (guarantorUser.id === requester.userId) {
      throw new BadRequestException('You cannot guarantee your own loan');
    }
    await this.assertActiveMembership(cooperativeId, guarantorUser.id);

    const existing = await this.prisma.loanGuarantor.findUnique({
      where: {
        loanId_guarantorUserId: { loanId, guarantorUserId: guarantorUser.id },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This guarantor has already been nominated for this loan',
      );
    }

    return this.prisma.loanGuarantor.create({
      data: { loanId, guarantorUserId: guarantorUser.id },
    });
  }

  async listGuarantors(
    cooperativeId: string,
    loanId: string,
    requester: AuthenticatedUser,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    await this.assertCanViewLoan(
      cooperativeId,
      loanId,
      loan.membership.userId,
      requester,
    );
    return this.prisma.loanGuarantor.findMany({
      where: { loanId },
      include: {
        guarantorUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async respondToGuarantorRequest(
    cooperativeId: string,
    loanId: string,
    guarantorId: string,
    requester: AuthenticatedUser,
    dto: RespondLoanGuarantorDto,
  ) {
    const guarantor = await this.prisma.loanGuarantor.findUnique({
      where: { id: guarantorId },
      include: { loan: true },
    });
    if (
      !guarantor ||
      guarantor.loan.cooperativeId !== cooperativeId ||
      guarantor.loanId !== loanId
    ) {
      throw new NotFoundException('Guarantor request not found');
    }
    if (guarantor.guarantorUserId !== requester.userId) {
      throw new ForbiddenException(
        'Only the nominated guarantor can respond to this request',
      );
    }

    return this.prisma.loanGuarantor.update({
      where: { id: guarantorId },
      data: {
        status:
          dto.status === 'APPROVED'
            ? GuarantorStatus.APPROVED
            : GuarantorStatus.DECLINED,
      },
    });
  }

  async approve(
    cooperativeId: string,
    loanId: string,
    actor: AuthenticatedUser,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException('Only pending loans can be approved');
    }

    const approvedGuarantors = await this.prisma.loanGuarantor.count({
      where: { loanId, status: GuarantorStatus.APPROVED },
    });
    if (approvedGuarantors < loan.product.requiredGuarantors) {
      throw new BadRequestException(
        `This loan requires ${loan.product.requiredGuarantors} approved guarantor(s); it currently has ${approvedGuarantors}`,
      );
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.APPROVED,
        approvedByUserId: actor.userId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(cooperativeId: string, loanId: string, dto: RejectLoanDto) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException('Only pending loans can be rejected');
    }
    return this.prisma.loan.update({
      where: { id: loanId },
      data: { status: LoanStatus.REJECTED, rejectionReason: dto.reason },
    });
  }

  async disburse(
    cooperativeId: string,
    loanId: string,
    actor: AuthenticatedUser,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException('Only approved loans can be disbursed');
    }

    const principal = loan.principal;
    const totalInterest = principal
      .times(loan.interestRatePercent)
      .dividedBy(100)
      .times(loan.termMonths)
      .dividedBy(12)
      .toDecimalPlaces(2);
    const totalRepayable = principal.plus(totalInterest);

    const n = loan.termMonths;
    const basePrincipal = principal.dividedBy(n).toDecimalPlaces(2);
    const baseInterest = totalInterest.dividedBy(n).toDecimalPlaces(2);

    const now = new Date();
    let principalAccum = new Prisma.Decimal(0);
    let interestAccum = new Prisma.Decimal(0);
    const installments: Prisma.RepaymentInstallmentCreateManyInput[] = [];
    for (let i = 1; i <= n; i++) {
      const isLast = i === n;
      const principalDue = isLast
        ? principal.minus(principalAccum)
        : basePrincipal;
      const interestDue = isLast
        ? totalInterest.minus(interestAccum)
        : baseInterest;
      principalAccum = principalAccum.plus(principalDue);
      interestAccum = interestAccum.plus(interestDue);
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + i);
      installments.push({
        loanId,
        installmentNumber: i,
        dueDate,
        principalDue,
        interestDue,
      });
    }

    await this.prisma.$transaction([
      this.prisma.loan.update({
        where: { id: loanId },
        data: {
          status: LoanStatus.ACTIVE,
          outstandingBalance: totalRepayable,
          disbursedByUserId: actor.userId,
          disbursedAt: now,
        },
      }),
      this.prisma.repaymentInstallment.createMany({ data: installments }),
      this.prisma.loanLedgerEntry.create({
        data: {
          loanId,
          type: LoanLedgerEntryType.DISBURSEMENT,
          amount: principal,
          balanceAfter: totalRepayable,
          recordedByUserId: actor.userId,
        },
      }),
    ]);

    return this.getLoan(cooperativeId, loanId, actor);
  }

  async recordRepayment(
    cooperativeId: string,
    loanId: string,
    actor: AuthenticatedUser,
    dto: RecordRepaymentDto,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Only active loans accept repayments');
    }

    const payment = new Prisma.Decimal(dto.amount);
    if (payment.greaterThan(loan.outstandingBalance)) {
      throw new BadRequestException('Payment exceeds the outstanding balance');
    }

    const openInstallments = await this.prisma.repaymentInstallment.findMany({
      where: { loanId, status: { not: RepaymentInstallmentStatus.PAID } },
      orderBy: { installmentNumber: 'asc' },
    });

    let remaining = payment;
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const installment of openInstallments) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const due = installment.principalDue
        .plus(installment.interestDue)
        .minus(installment.amountPaid);
      const applied = Prisma.Decimal.min(remaining, due);
      const newAmountPaid = installment.amountPaid.plus(applied);
      const fullyPaid = newAmountPaid.greaterThanOrEqualTo(
        installment.principalDue.plus(installment.interestDue),
      );
      updates.push(
        this.prisma.repaymentInstallment.update({
          where: { id: installment.id },
          data: {
            amountPaid: newAmountPaid,
            status: fullyPaid
              ? RepaymentInstallmentStatus.PAID
              : RepaymentInstallmentStatus.PARTIAL,
            paidAt: fullyPaid ? new Date() : installment.paidAt,
          },
        }),
      );
      remaining = remaining.minus(applied);
    }

    const newOutstandingRaw = loan.outstandingBalance.minus(payment);
    const newOutstanding = newOutstandingRaw.lessThan(0)
      ? new Prisma.Decimal(0)
      : newOutstandingRaw;
    const isCompleted = newOutstanding.lessThanOrEqualTo(0);

    const results = await this.prisma.$transaction([
      ...updates,
      this.prisma.loan.update({
        where: { id: loanId },
        data: {
          outstandingBalance: newOutstanding,
          status: isCompleted ? LoanStatus.COMPLETED : LoanStatus.ACTIVE,
          completedAt: isCompleted ? new Date() : null,
        },
      }),
      this.prisma.loanLedgerEntry.create({
        data: {
          loanId,
          type: LoanLedgerEntryType.REPAYMENT,
          amount: payment,
          balanceAfter: newOutstanding,
          narration: dto.narration,
          recordedByUserId: actor.userId,
        },
      }),
    ]);

    return results[results.length - 1];
  }

  async assessPenalty(
    cooperativeId: string,
    loanId: string,
    actor: AuthenticatedUser,
  ) {
    const loan = await this.getLoanOrThrow(cooperativeId, loanId);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Only active loans can be penalized');
    }

    const now = new Date();
    const overdue = await this.prisma.repaymentInstallment.findMany({
      where: {
        loanId,
        dueDate: { lt: now },
        status: {
          in: [
            RepaymentInstallmentStatus.PENDING,
            RepaymentInstallmentStatus.PARTIAL,
          ],
        },
      },
    });
    if (overdue.length === 0) {
      throw new BadRequestException(
        'No newly overdue installments to penalize',
      );
    }

    let totalOverdue = new Prisma.Decimal(0);
    for (const installment of overdue) {
      totalOverdue = totalOverdue.plus(
        installment.principalDue
          .plus(installment.interestDue)
          .minus(installment.amountPaid),
      );
    }
    const penalty = totalOverdue
      .times(loan.product.penaltyRatePercent)
      .dividedBy(100)
      .toDecimalPlaces(2);
    if (penalty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('No penalty is due');
    }

    const newOutstanding = loan.outstandingBalance.plus(penalty);

    const results = await this.prisma.$transaction([
      ...overdue.map((installment) =>
        this.prisma.repaymentInstallment.update({
          where: { id: installment.id },
          data: { status: RepaymentInstallmentStatus.OVERDUE },
        }),
      ),
      this.prisma.loan.update({
        where: { id: loanId },
        data: { outstandingBalance: newOutstanding },
      }),
      this.prisma.loanLedgerEntry.create({
        data: {
          loanId,
          type: LoanLedgerEntryType.PENALTY,
          amount: penalty,
          balanceAfter: newOutstanding,
          recordedByUserId: actor.userId,
        },
      }),
    ]);

    return results[results.length - 1];
  }

  private async getProductOrThrow(cooperativeId: string, productId: string) {
    const product = await this.prisma.loanProduct.findUnique({
      where: { id: productId },
    });
    if (!product || product.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Loan product not found');
    }
    return product;
  }

  private async getLoanOrThrow(cooperativeId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { product: true, membership: { include: { user: true } } },
    });
    if (!loan || loan.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Loan not found');
    }
    return loan;
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.REGULATOR) {
      return;
    }
    await this.assertActiveMembership(cooperativeId, user.userId);
  }

  private async assertActiveMembership(cooperativeId: string, userId: string) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
  }

  private async assertSelfOrViewRole(
    cooperativeId: string,
    targetUserId: string,
    requester: AuthenticatedUser,
  ) {
    if (
      requester.userId === targetUserId ||
      requester.role === Role.SUPER_ADMIN
    ) {
      return;
    }
    const requesterMembership =
      await this.prisma.cooperativeMembership.findUnique({
        where: {
          cooperativeId_userId: { cooperativeId, userId: requester.userId },
        },
      });
    const canView =
      !!requesterMembership &&
      requesterMembership.status === MembershipStatus.ACTIVE &&
      (VIEW_LOAN_ROLES as readonly Role[]).includes(requesterMembership.role);
    if (!canView) {
      throw new ForbiddenException(
        "You do not have permission to view this member's loans",
      );
    }
  }

  // Like assertSelfOrViewRole, but also lets a nominated guarantor see the
  // one loan they were asked to guarantee (otherwise they'd have no way to
  // find their own guarantor request id to respond to it).
  private async assertCanViewLoan(
    cooperativeId: string,
    loanId: string,
    borrowerUserId: string,
    requester: AuthenticatedUser,
  ) {
    try {
      await this.assertSelfOrViewRole(cooperativeId, borrowerUserId, requester);
      return;
    } catch (err) {
      const isGuarantor = await this.prisma.loanGuarantor.findUnique({
        where: {
          loanId_guarantorUserId: { loanId, guarantorUserId: requester.userId },
        },
      });
      if (!isGuarantor) {
        throw err;
      }
    }
  }
}
