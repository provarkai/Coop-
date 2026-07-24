import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface MembershipCardPdfInput {
  cooperativeName: string;
  memberName: string;
  membershipNumber: string | null;
  role: string;
  category: string;
  joinedAt: Date;
  qrCodeDataUrl: string;
}

interface MeetingMinutesPdfInput {
  cooperativeName: string;
  meetingTitle: string;
  meetingType: string;
  scheduledAt: Date;
  location: string | null;
  agendaItems: { order: number; title: string; description: string | null }[];
  resolutions: {
    title: string;
    status: string;
    forCount: number;
    againstCount: number;
    abstainCount: number;
  }[];
  minutes: string | null;
}

interface DashboardReportPdfInput {
  cooperativeName: string;
  period: string;
  summary: {
    activeMembers: number;
    pendingApplications: number;
    totalSavingsBalance: string;
    totalOutstandingLoans: string;
    loansDisbursedThisMonth: string;
    paymentsThisMonthCount: number;
    paymentsThisMonthTotal: string;
    upcomingMeetings: number;
    openResolutions: number;
    cashBalance: string;
    totalIncome: string;
    totalExpense: string;
    netSurplus: string;
  };
}

@Injectable()
export class PdfService {
  generateMembershipCardPdf(data: MembershipCardPdfInput): Promise<Buffer> {
    return this.render((doc) => {
      doc.fontSize(20).text('Membership Card', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(data.cooperativeName, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Member: ${data.memberName}`);
      doc.text(`Membership No: ${data.membershipNumber ?? 'N/A'}`);
      doc.text(`Role: ${data.role}`);
      doc.text(`Category: ${data.category}`);
      doc.text(`Joined: ${data.joinedAt.toDateString()}`);
      doc.moveDown();
      const qrBuffer = Buffer.from(
        data.qrCodeDataUrl.split(',')[1] ?? '',
        'base64',
      );
      if (qrBuffer.length > 0) {
        doc.image(qrBuffer, { fit: [150, 150], align: 'center' });
      }
    });
  }

  generateMeetingMinutesPdf(data: MeetingMinutesPdfInput): Promise<Buffer> {
    return this.render((doc) => {
      doc.fontSize(18).text(data.meetingTitle, { align: 'center' });
      doc.fontSize(10).text(data.cooperativeName, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Type: ${data.meetingType}`);
      doc.text(`Scheduled (UTC): ${data.scheduledAt.toISOString()}`);
      if (data.location) {
        doc.text(`Location: ${data.location}`);
      }
      doc.moveDown();

      doc.fontSize(14).text('Agenda');
      doc.moveDown(0.5);
      if (data.agendaItems.length === 0) {
        doc.fontSize(11).text('No agenda items.');
      }
      for (const item of data.agendaItems) {
        doc.fontSize(11).text(`${item.order}. ${item.title}`);
        if (item.description) {
          doc.fontSize(10).text(item.description, { indent: 12 });
        }
      }
      doc.moveDown();

      doc.fontSize(14).text('Resolutions');
      doc.moveDown(0.5);
      if (data.resolutions.length === 0) {
        doc.fontSize(11).text('No resolutions were proposed.');
      }
      for (const r of data.resolutions) {
        doc
          .fontSize(11)
          .text(
            `${r.title} — ${r.status} (FOR ${r.forCount} / AGAINST ${r.againstCount} / ABSTAIN ${r.abstainCount})`,
          );
      }
      doc.moveDown();

      doc.fontSize(14).text('Minutes');
      doc.moveDown(0.5);
      doc.fontSize(11).text(data.minutes ?? 'Not yet recorded.');
    });
  }

  generateDashboardReportPdf(data: DashboardReportPdfInput): Promise<Buffer> {
    return this.render((doc) => {
      doc
        .fontSize(18)
        .text(`Monthly Report — ${data.period}`, { align: 'center' });
      doc.fontSize(10).text(data.cooperativeName, { align: 'center' });
      doc.moveDown();

      const s = data.summary;
      doc.fontSize(14).text('Membership');
      doc.fontSize(11).text(`Active members: ${s.activeMembers}`);
      doc.text(`Pending applications: ${s.pendingApplications}`);
      doc.moveDown();

      doc.fontSize(14).text('Savings & Loans');
      doc.fontSize(11).text(`Total savings balance: ${s.totalSavingsBalance}`);
      doc.text(`Total outstanding loans: ${s.totalOutstandingLoans}`);
      doc.text(`Loans disbursed this month: ${s.loansDisbursedThisMonth}`);
      doc.moveDown();

      doc.fontSize(14).text('Payments');
      doc
        .fontSize(11)
        .text(
          `Successful payments this month: ${s.paymentsThisMonthCount} totalling ${s.paymentsThisMonthTotal}`,
        );
      doc.moveDown();

      doc.fontSize(14).text('Accounting');
      doc.fontSize(11).text(`Cash balance: ${s.cashBalance}`);
      doc.text(`Total income: ${s.totalIncome}`);
      doc.text(`Total expense: ${s.totalExpense}`);
      doc.text(`Net surplus: ${s.netSurplus}`);
      doc.moveDown();

      doc.fontSize(14).text('Governance');
      doc.fontSize(11).text(`Upcoming meetings: ${s.upcomingMeetings}`);
      doc.text(`Open resolutions: ${s.openResolutions}`);
    });
  }

  private render(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }
}
