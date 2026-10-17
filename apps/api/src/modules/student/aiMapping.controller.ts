import { Response, NextFunction, Request } from 'express';
import { aiMappingService } from './aiMapping.service';
import { ApiError } from '../../middleware/errorHandler';

class StudentAiMappingController {
  /**
   * POST /students/bulk-upload/ai-parse
   *
   * multipart/form-data:
   *   file: the uploaded .xlsx / .xls / .csv
   *
   * Response: { rows, mapping, totalRows, headers }
   *
   * The returned `rows` are shaped identically to the rows the existing
   * /validate and /bulk-upload endpoints already accept — the frontend feeds
   * them straight into the review table.
   */
  async parse(req: Request, res: Response, next: NextFunction) {
    try {
      if (!aiMappingService.isConfigured()) {
        throw new ApiError(
          'AI_NOT_CONFIGURED',
          'OPENAI_API_KEY is not set. Use the template-download path instead.',
          503
        );
      }

      const file = req.file;
      if (!file) {
        throw new ApiError('FILE_REQUIRED', 'A file upload is required', 400);
      }

      const result = await aiMappingService.parseAndMap(file.buffer, file.originalname);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const studentAiMappingController = new StudentAiMappingController();
