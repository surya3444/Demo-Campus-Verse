import { resolveReceiptIssuer } from './receiptIssuer';
import PDFDocument from 'pdfkit';
import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';

type PDFDocType = InstanceType<typeof PDFDocument>;

interface TransactionData {
  _id: string;
  receiptNumber: string;
  receiptDate: Date;
  paymentMode: string;
  paymentDetails?: {
    referenceNumber?: string;
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: Date;
    cardLast4?: string;
    upiId?: string;
  };
  components: Array<{
    componentCode: string;
    name: string;
    amount: number;
  }>;
  installmentNumbers: number[];
  feeAmount: number;
  fineAmount: number;
  adjustments: number;
  totalAmount: number;
  status: string;
  remarks?: string;
}

interface StudentData {
  _id: string;
  admissionNumber: string;
  displayName: string;
  currentEnrollment?: {
    className?: string;
    sectionName?: string;
  };
  guardians?: Array<{
    name?: string;
    phone?: string;
  }>;
}

interface BranchData {
  name: string;
  code: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  phone?: string;
  email?: string;
}

interface TenantData {
  name: string;
  logo?: string;
}

class ReceiptPdfService {
  async generateReceipt(tenantId: string, transactionId: string): Promise<Buffer> {
    // Fetch all required data
    const transaction = await collections.feeTransactions.findOne({
      _id: new ObjectId(transactionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const [student, branch, tenant] = await Promise.all([
      collections.students.findOne({
        _id: transaction.studentId,
        tenantId: new ObjectId(tenantId),
      }),
      collections.branches.findOne({
        _id: transaction.branchId,
        tenantId: new ObjectId(tenantId),
      }),
      collections.tenants.findOne({
        _id: new ObjectId(tenantId),
      }),
    ]);

    if (!student) {
      throw new Error('Student not found');
    }

    return this.createPdf(
      this.formatTransaction(transaction),
      this.formatStudent(student),
      branch ? this.formatBranch(branch) : null,
      // Same issuer as the on-screen receipt: the student's college, else the organization.
      tenant
        ? await resolveReceiptIssuer(
            new ObjectId(tenantId),
            transaction.branchId as ObjectId,
            transaction.studentId as ObjectId
          )
        : null
    );
  }

  private createPdf(
    transaction: TransactionData,
    student: StudentData,
    branch: BranchData | null,
    tenant: TenantData | null
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc, branch, tenant);

      // Receipt title
      doc.moveDown(2);
      doc.fontSize(16).font('Helvetica-Bold').text('FEE RECEIPT', { align: 'center' });
      doc.moveDown(0.5);

      // Receipt details box
      this.drawReceiptDetails(doc, transaction);

      // Student details
      doc.moveDown(1);
      this.drawStudentDetails(doc, student);

      // Fee breakdown table
      doc.moveDown(1);
      this.drawFeeTable(doc, transaction);

      // Payment details
      doc.moveDown(1);
      this.drawPaymentDetails(doc, transaction);

      // Footer
      this.drawFooter(doc);

      doc.end();
    });
  }

  private drawHeader(doc: PDFDocType, branch: BranchData | null, tenant: TenantData | null) {
    // Institution name
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text(tenant?.name || 'Educational Institution', { align: 'center' });

    // Branch details
    if (branch) {
      doc.fontSize(10).font('Helvetica');
      doc.text(branch.name, { align: 'center' });

      if (branch.address) {
        const addressParts = [
          branch.address.line1,
          branch.address.line2,
          branch.address.city,
          branch.address.state,
          branch.address.pincode,
        ].filter(Boolean);
        doc.text(addressParts.join(', '), { align: 'center' });
      }

      const contactParts = [
        branch.phone ? `Phone: ${branch.phone}` : null,
        branch.email ? `Email: ${branch.email}` : null,
      ].filter(Boolean);
      if (contactParts.length > 0) {
        doc.text(contactParts.join(' | '), { align: 'center' });
      }
    }

    // Draw line under header
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  }

  private drawReceiptDetails(doc: PDFDocType, transaction: TransactionData) {
    const startY = doc.y;
    const leftCol = 50;
    const rightCol = 350;

    doc.fontSize(10).font('Helvetica');

    // Left column
    doc.text('Receipt No:', leftCol, startY);
    doc.font('Helvetica-Bold').text(transaction.receiptNumber, leftCol + 80, startY);

    doc.font('Helvetica').text('Date:', leftCol, startY + 15);
    doc
      .font('Helvetica-Bold')
      .text(this.formatDate(transaction.receiptDate), leftCol + 80, startY + 15);

    // Right column
    doc.font('Helvetica').text('Status:', rightCol, startY);
    const statusColor = transaction.status === 'success' ? 'green' : 'red';
    doc
      .fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(transaction.status.toUpperCase(), rightCol + 60, startY);
    doc.fillColor('black');

    doc.font('Helvetica').text('Payment Mode:', rightCol, startY + 15);
    doc
      .font('Helvetica-Bold')
      .text(this.formatPaymentMode(transaction.paymentMode), rightCol + 80, startY + 15);

    doc.y = startY + 40;
  }

  private drawStudentDetails(doc: PDFDocType, student: StudentData) {
    doc.fontSize(11).font('Helvetica-Bold').text('STUDENT DETAILS');
    doc.moveDown(0.3);

    const startY = doc.y;
    const leftCol = 50;
    const rightCol = 300;

    doc.fontSize(10).font('Helvetica');

    // Left column
    doc.text('Admission No:', leftCol, startY);
    doc.font('Helvetica-Bold').text(student.admissionNumber, leftCol + 100, startY);

    doc.font('Helvetica').text('Student Name:', leftCol, startY + 15);
    doc.font('Helvetica-Bold').text(student.displayName, leftCol + 100, startY + 15);

    // Right column
    doc.font('Helvetica').text('Class:', rightCol, startY);
    doc
      .font('Helvetica-Bold')
      .text(student.currentEnrollment?.className || 'N/A', rightCol + 60, startY);

    doc.font('Helvetica').text('Section:', rightCol, startY + 15);
    doc
      .font('Helvetica-Bold')
      .text(student.currentEnrollment?.sectionName || 'N/A', rightCol + 60, startY + 15);

    if (student.guardians?.[0]?.name) {
      doc.font('Helvetica').text('Parent/Guardian:', leftCol, startY + 30);
      doc.font('Helvetica-Bold').text(student.guardians[0].name, leftCol + 100, startY + 30);
    }

    doc.y = startY + 50;
  }

  private drawFeeTable(doc: PDFDocType, transaction: TransactionData) {
    doc.fontSize(11).font('Helvetica-Bold').text('FEE DETAILS');
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [40, 280, 100, 75];
    const colPositions = [
      tableLeft,
      tableLeft + colWidths[0],
      tableLeft + colWidths[0] + colWidths[1],
      tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
    ];

    // Table header
    doc.rect(tableLeft, tableTop, 495, 20).fill('#f0f0f0');
    doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
    doc.text('S.No', colPositions[0] + 5, tableTop + 6);
    doc.text('Fee Component', colPositions[1] + 5, tableTop + 6);
    doc.text('Installments', colPositions[2] + 5, tableTop + 6);
    doc.text('Amount (₹)', colPositions[3] + 5, tableTop + 6);

    // Table rows
    let currentY = tableTop + 20;
    doc.font('Helvetica').fontSize(9);

    transaction.components.forEach((component, index) => {
      doc.text(String(index + 1), colPositions[0] + 5, currentY + 5);
      doc.text(component.name, colPositions[1] + 5, currentY + 5);
      doc.text(transaction.installmentNumbers.join(', '), colPositions[2] + 5, currentY + 5);
      doc.text(this.formatCurrency(component.amount), colPositions[3] + 5, currentY + 5, {
        width: 70,
        align: 'right',
      });
      currentY += 18;

      // Row separator
      doc
        .moveTo(tableLeft, currentY)
        .lineTo(tableLeft + 495, currentY)
        .stroke('#e0e0e0');
    });

    // Summary rows
    currentY += 5;

    // Fee Amount
    doc.font('Helvetica').text('Fee Amount:', colPositions[2] + 5, currentY + 5);
    doc.text(this.formatCurrency(transaction.feeAmount), colPositions[3] + 5, currentY + 5, {
      width: 70,
      align: 'right',
    });
    currentY += 18;

    // Fine Amount (if any)
    if (transaction.fineAmount > 0) {
      doc.text('Fine Amount:', colPositions[2] + 5, currentY + 5);
      doc.text(this.formatCurrency(transaction.fineAmount), colPositions[3] + 5, currentY + 5, {
        width: 70,
        align: 'right',
      });
      currentY += 18;
    }

    // Adjustments (if any)
    if (transaction.adjustments !== 0) {
      doc.text('Adjustments:', colPositions[2] + 5, currentY + 5);
      doc.text(this.formatCurrency(transaction.adjustments), colPositions[3] + 5, currentY + 5, {
        width: 70,
        align: 'right',
      });
      currentY += 18;
    }

    // Total
    doc.rect(colPositions[2], currentY, colWidths[2] + colWidths[3], 22).fill('#f0f0f0');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL:', colPositions[2] + 5, currentY + 6);
    doc.text(
      '₹ ' + this.formatCurrency(transaction.totalAmount),
      colPositions[3] + 5,
      currentY + 6,
      { width: 70, align: 'right' }
    );

    doc.y = currentY + 30;
  }

  private drawPaymentDetails(doc: PDFDocType, transaction: TransactionData) {
    if (!transaction.paymentDetails) return;

    doc.fontSize(11).font('Helvetica-Bold').text('PAYMENT DETAILS');
    doc.moveDown(0.3);

    doc.fontSize(9).font('Helvetica');

    const details = transaction.paymentDetails;
    const startY = doc.y;

    if (details.referenceNumber) {
      doc.text(`Reference Number: ${details.referenceNumber}`, 50, startY);
    }
    if (details.bankName) {
      doc.text(`Bank: ${details.bankName}`, 50, startY + 12);
    }
    if (details.chequeNumber) {
      doc.text(`Cheque No: ${details.chequeNumber}`, 50, startY + 24);
    }
    if (details.chequeDate) {
      doc.text(`Cheque Date: ${this.formatDate(details.chequeDate)}`, 200, startY + 24);
    }
    if (details.upiId) {
      doc.text(`UPI ID: ${details.upiId}`, 50, startY + 12);
    }
    if (details.cardLast4) {
      doc.text(`Card ending: ****${details.cardLast4}`, 50, startY + 12);
    }

    if (transaction.remarks) {
      doc.moveDown(0.5);
      doc.text(`Remarks: ${transaction.remarks}`);
    }
  }

  private drawFooter(doc: PDFDocType) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 100;

    doc.fontSize(9).font('Helvetica');

    // Amount in words
    doc.text(
      'This is a computer-generated receipt and does not require a signature.',
      50,
      footerY,
      { align: 'center' }
    );

    // Signature lines
    doc.text('Collected By', 80, footerY + 30);
    doc
      .moveTo(60, footerY + 50)
      .lineTo(160, footerY + 50)
      .stroke();

    doc.text('Authorized Signatory', 400, footerY + 30);
    doc
      .moveTo(380, footerY + 50)
      .lineTo(520, footerY + 50)
      .stroke();
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatPaymentMode(mode: string): string {
    const modeMap: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      upi: 'UPI',
      netbanking: 'Net Banking',
      cheque: 'Cheque',
      dd: 'Demand Draft',
      wallet: 'Wallet',
    };
    return modeMap[mode] || mode;
  }

  private formatTransaction(transaction: Document): TransactionData {
    return {
      _id: transaction._id.toString(),
      receiptNumber: transaction.receiptNumber,
      receiptDate: transaction.receiptDate,
      paymentMode: transaction.paymentMode,
      paymentDetails: transaction.paymentDetails,
      components: transaction.components || [],
      installmentNumbers: transaction.installmentNumbers || [],
      feeAmount: transaction.feeAmount || 0,
      fineAmount: transaction.fineAmount || 0,
      adjustments: transaction.adjustments || 0,
      totalAmount: transaction.totalAmount || 0,
      status: transaction.status,
      remarks: transaction.remarks,
    };
  }

  private formatStudent(student: Document): StudentData {
    return {
      _id: student._id.toString(),
      admissionNumber: student.admissionNumber,
      displayName: student.displayName,
      currentEnrollment: student.currentEnrollment,
      guardians: student.guardians,
    };
  }

  private formatBranch(branch: Document): BranchData {
    return {
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
    };
  }
}

export const receiptPdfService = new ReceiptPdfService();
