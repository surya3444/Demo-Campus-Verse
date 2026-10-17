import { Request, Response, NextFunction } from 'express';
import { pipelineService, PipelineStage, PIPELINE_STAGES } from './pipeline.service';

class PipelineController {
  async getPipeline(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, source } = req.query;

      const pipeline = await pipelineService.getPipeline(req.tenantId!, req.branchId!, {
        search: search as string,
        source: source as string,
      });

      res.json({
        success: true,
        data: pipeline,
      });
    } catch (error) {
      next(error);
    }
  }

  async moveCard(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { type, toStage, notes } = req.body;

      // Validate inputs
      if (!type || !['lead', 'application'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TYPE', message: 'Type must be "lead" or "application"' },
        });
      }

      if (!toStage || !PIPELINE_STAGES.includes(toStage)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STAGE',
            message: `Stage must be one of: ${PIPELINE_STAGES.join(', ')}`,
          },
        });
      }

      const result = await pipelineService.moveCard(
        req.tenantId!,
        req.branchId!,
        id,
        type as 'lead' | 'application',
        toStage as PipelineStage,
        req.user!.userId,
        notes
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async convertLead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { academicBatchId, classId, sectionId, student, contact } = req.body;

      // Basic validation
      if (!academicBatchId || !classId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'academicBatchId and classId are required',
          },
        });
      }

      const result = await pipelineService.convertLeadToApplication(
        req.tenantId!,
        req.branchId!,
        id,
        { academicBatchId, classId, sectionId, student, contact },
        req.user!.userId
      );

      res.json({
        success: true,
        data: result,
        message: 'Lead converted to application successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pipelineController = new PipelineController();
