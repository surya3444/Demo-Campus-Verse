import { Request, Response, NextFunction } from 'express';
import {
  feeTransactionService,
  TransactionListParams,
  InitiateOnlinePaymentInput,
  VerifyOnlinePaymentInput,
} from './feeTransaction.service';
import { receiptPdfService } from './receiptPdf.service';
import { success, created } from '../../utils/response';
import { assertStudentInScope } from '../teaching/scope';

class FeeTransactionController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const params: TransactionListParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        studentId: req.query.studentId as string,
        classId: req.query.classId as string,
        sectionId: req.query.sectionId as string,
        paymentMode: req.query.paymentMode as string,
        status: req.query.status as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        collectedBy: req.query.collectedBy as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await feeTransactionService.findAll(req.tenantId!, req.branchId, params);
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const transaction = await feeTransactionService.findById(
        req.tenantId!,
        req.params.id as string
      );
      success(res, transaction);
    } catch (error) {
      next(error);
    }
  }

  async collect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      if (req.body?.studentId) await assertStudentInScope(req, String(req.body.studentId));
      const transaction = await feeTransactionService.collectFee(
        req.tenantId!,
        req.branchId,
        req.body,
        req.user!.userId
      );
      created(res, transaction, 'Fee collected successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Cancellation reason is required' },
        });
      }

      const result = await feeTransactionService.cancel(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        reason,
        req.user!.userId
      );

      // Check if approval is required
      if (result && 'requiresApproval' in result) {
        return res.status(202).json({
          success: true,
          data: result,
          message: result.message,
        });
      }

      success(res, result, undefined, 'Transaction cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async refund(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { amount, reason } = req.body;

      if (!amount || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Amount and reason are required' },
        });
      }

      const result = await feeTransactionService.refund(
        req.tenantId!,
        req.branchId,
        req.params.id as string,
        amount,
        reason,
        req.user!.userId
      );

      // Check if approval is required
      if (result && 'requiresApproval' in result) {
        return res.status(202).json({
          success: true,
          data: result,
          message: result.message,
        });
      }

      success(res, result, undefined, 'Refund processed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string;

      // If JSON format is requested, return transaction data
      if (format === 'json') {
        const transaction = await feeTransactionService.findById(
          req.tenantId!,
          req.params.id as string
        );
        success(res, transaction);
        return;
      }

      // Generate PDF receipt
      const pdfBuffer = await receiptPdfService.generateReceipt(
        req.tenantId!,
        req.params.id as string
      );

      // Get transaction for receipt number
      const transaction = await feeTransactionService.findById(
        req.tenantId!,
        req.params.id as string
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Receipt-${transaction.receiptNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  async getDaySheet(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const result = await feeTransactionService.getDaySheet(req.tenantId!, req.branchId, date);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getCollectionSummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const fromDate = req.query.fromDate as string;
      const toDate = req.query.toDate as string;

      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'fromDate and toDate are required' },
        });
      }

      const result = await feeTransactionService.getCollectionSummary(
        req.tenantId!,
        req.branchId,
        fromDate,
        toDate
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async initiateOnlinePayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const input: InitiateOnlinePaymentInput = {
        studentId: req.body.studentId,
        feeAssignmentId: req.body.feeAssignmentId,
        components: req.body.components,
        installmentNumbers: req.body.installmentNumbers,
        feeAmount: req.body.feeAmount,
        fineAmount: req.body.fineAmount,
        adjustments: req.body.adjustments,
        remarks: req.body.remarks,
      };

      const result = await feeTransactionService.initiateOnlinePayment(
        req.tenantId!,
        req.branchId,
        input,
        req.user!.userId
      );
      created(res, result, 'Payment order created successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyOnlinePayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const input: VerifyOnlinePaymentInput = {
        orderId: req.body.orderId,
        paymentId: req.body.paymentId,
        signature: req.body.signature,
      };

      if (!input.orderId || !input.paymentId || !input.signature) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId, paymentId, and signature are required',
          },
        });
      }

      const result = await feeTransactionService.verifyOnlinePayment(
        req.tenantId!,
        req.branchId,
        input,
        req.user!.userId
      );
      success(res, result, undefined, 'Payment verified successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const feeTransactionController = new FeeTransactionController();
