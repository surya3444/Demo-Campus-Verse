import { Request, Response, NextFunction } from 'express';
import {
  customFieldService,
  CustomFieldListParams,
  CustomFieldModule,
  CustomFieldType,
} from './customField.service';
import { success, created } from '../../utils/response';

const VALID_MODULES: CustomFieldModule[] = ['admission', 'student', 'staff', 'fee', 'attendance'];
const VALID_TYPES: CustomFieldType[] = [
  'text',
  'number',
  'date',
  'select',
  'multiselect',
  'checkbox',
  'file',
  'textarea',
];

class CustomFieldController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const params: CustomFieldListParams = {
        module: req.query.module as CustomFieldModule,
        status: req.query.status as 'active' | 'inactive',
        showInList:
          req.query.showInList !== undefined ? req.query.showInList === 'true' : undefined,
        showInFilters:
          req.query.showInFilters !== undefined ? req.query.showInFilters === 'true' : undefined,
      };

      const result = await customFieldService.findAll(req.tenantId!, params);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const field = await customFieldService.findById(req.tenantId!, req.params.id as string);
      success(res, field);
    } catch (error) {
      next(error);
    }
  }

  async getByModule(req: Request, res: Response, next: NextFunction) {
    try {
      const { module } = req.params;
      const activeOnly = req.query.activeOnly !== 'false';

      if (!VALID_MODULES.includes(module as CustomFieldModule)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}`,
          },
        });
      }

      const fields = await customFieldService.getByModule(
        req.tenantId!,
        module as CustomFieldModule,
        activeOnly
      );
      success(res, fields);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        module,
        fieldName,
        fieldKey,
        fieldType,
        options,
        required,
        validation,
        placeholder,
        helpText,
        showInList,
        showInFilters,
      } = req.body;

      // Validation
      if (!module || !fieldName || !fieldKey || !fieldType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'module, fieldName, fieldKey, and fieldType are required',
          },
        });
      }

      if (!VALID_MODULES.includes(module)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}`,
          },
        });
      }

      if (!VALID_TYPES.includes(fieldType)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid fieldType. Must be one of: ${VALID_TYPES.join(', ')}`,
          },
        });
      }

      // Validate field key format (alphanumeric and underscores only)
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldKey)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'fieldKey must start with a letter and contain only letters, numbers, and underscores',
          },
        });
      }

      // Validate options for select/multiselect types
      if (
        (fieldType === 'select' || fieldType === 'multiselect') &&
        (!options || options.length === 0)
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Options are required for select and multiselect field types',
          },
        });
      }

      const field = await customFieldService.create(
        req.tenantId!,
        {
          module,
          fieldName,
          fieldKey,
          fieldType,
          options,
          required,
          validation,
          placeholder,
          helpText,
          showInList,
          showInFilters,
        },
        req.user!.userId
      );

      created(res, field, 'Custom field created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        fieldName,
        fieldType,
        options,
        required,
        validation,
        placeholder,
        helpText,
        showInList,
        showInFilters,
        status,
      } = req.body;

      if (fieldType !== undefined && !VALID_TYPES.includes(fieldType)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid fieldType. Must be one of: ${VALID_TYPES.join(', ')}`,
          },
        });
      }

      if (
        fieldType !== undefined &&
        (fieldType === 'select' || fieldType === 'multiselect') &&
        (!options || !Array.isArray(options) || options.length === 0)
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Options are required for select and multiselect field types',
          },
        });
      }

      if (status !== undefined && status !== 'active' && status !== 'inactive') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'status must be either "active" or "inactive"',
          },
        });
      }

      if (fieldName !== undefined && (typeof fieldName !== 'string' || !fieldName.trim())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'fieldName must be a non-empty string',
          },
        });
      }

      const field = await customFieldService.update(
        req.tenantId!,
        req.params.id as string,
        {
          fieldName,
          fieldType,
          options,
          required,
          validation,
          placeholder,
          helpText,
          showInList,
          showInFilters,
          status,
        },
        req.user!.userId
      );
      success(res, field, undefined, 'Custom field updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await customFieldService.delete(req.tenantId!, req.params.id as string, req.user!.userId);
      success(res, { deleted: true }, undefined, 'Custom field deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const { module, fieldOrder } = req.body;

      if (!module || !fieldOrder || !Array.isArray(fieldOrder)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'module and fieldOrder (array of field IDs) are required',
          },
        });
      }

      if (!VALID_MODULES.includes(module)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}`,
          },
        });
      }

      const fields = await customFieldService.reorder(
        req.tenantId!,
        module,
        fieldOrder,
        req.user!.userId
      );
      success(res, fields, undefined, 'Custom fields reordered successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const customFieldController = new CustomFieldController();
