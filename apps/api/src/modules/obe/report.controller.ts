import { Request, Response, NextFunction } from 'express';
import { obeReportService } from './report.service';
import { accreditationService } from './accreditation.service';
import { renderNbaCriterion3Pdf, renderNaacKeyIndicator26Pdf } from './accreditation.pdf';
import { success } from '../../utils/response';

/** Filename-safe slug for report downloads. */
function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'report'
  );
}

class ObeReportController {
  async programAttainment(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await obeReportService.programAttainment(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        {
          academicBatchId: req.query.academicBatchId as string | undefined,
          termId: req.query.termId as string | undefined,
        }
      );
      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async exportCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await obeReportService.courseReportCsv(
        req.tenantId!,
        req.branchId!,
        req.params.id as string
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="course-attainment.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportProgram(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await obeReportService.programReportCsv(
        req.tenantId!,
        req.branchId!,
        req.params.id as string,
        {
          academicBatchId: req.query.academicBatchId as string | undefined,
          termId: req.query.termId as string | undefined,
        }
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="program-attainment.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * NBA SAR Criterion 3. `?format=pdf` renders the printable file; the JSON
   * shape is the same document, for the on-screen preview.
   */
  async nbaCriterion3(req: Request, res: Response, next: NextFunction) {
    try {
      const programId = req.params.id as string;
      await accreditationService.assertHasComputedData(req.tenantId!, req.branchId!, programId);

      const report = await accreditationService.nbaCriterion3(
        req.tenantId!,
        req.branchId!,
        programId,
        {
          academicBatchId: req.query.academicBatchId as string | undefined,
          termId: req.query.termId as string | undefined,
        }
      );

      if (req.query.format === 'pdf') {
        const pdf = await renderNbaCriterion3Pdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="nba-criterion-3-${slug(report.meta.program.name)}.pdf"`
        );
        res.send(pdf);
        return;
      }

      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  /** NAAC SSR Criterion 2, Key Indicator 2.6. */
  async naacKeyIndicator26(req: Request, res: Response, next: NextFunction) {
    try {
      const programId = req.params.id as string;
      await accreditationService.assertHasComputedData(req.tenantId!, req.branchId!, programId);

      const report = await accreditationService.naacKeyIndicator26(
        req.tenantId!,
        req.branchId!,
        programId,
        {
          academicBatchId: req.query.academicBatchId as string | undefined,
          termId: req.query.termId as string | undefined,
        }
      );

      if (req.query.format === 'pdf') {
        const pdf = await renderNaacKeyIndicator26Pdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="naac-2-6-${slug(report.meta.program.name)}.pdf"`
        );
        res.send(pdf);
        return;
      }

      success(res, report);
    } catch (error) {
      next(error);
    }
  }

  /** Branch-level NIRF data points the ERP can actually evidence. */
  async nirf(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await accreditationService.nirfDataPoints(req.tenantId!, req.branchId!, {
        academicBatchId: req.query.academicBatchId as string | undefined,
      });
      success(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export const obeReportController = new ObeReportController();
