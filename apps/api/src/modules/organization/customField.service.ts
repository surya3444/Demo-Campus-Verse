import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type CustomFieldModule = 'admission' | 'student' | 'staff' | 'fee' | 'attendance';
export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'file'
  | 'textarea';

export interface CustomFieldDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  module: CustomFieldModule;
  fieldName: string;
  fieldKey: string;
  fieldType: CustomFieldType;
  options?: string[];
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  placeholder?: string;
  helpText?: string;
  displayOrder: number;
  showInList: boolean;
  showInFilters: boolean;
  status: 'active' | 'inactive';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomFieldInput {
  module: CustomFieldModule;
  fieldName: string;
  fieldKey: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  placeholder?: string;
  helpText?: string;
  showInList?: boolean;
  showInFilters?: boolean;
}

export interface UpdateCustomFieldInput {
  fieldName?: string;
  fieldType?: CustomFieldType;
  options?: string[];
  required?: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  placeholder?: string;
  helpText?: string;
  showInList?: boolean;
  showInFilters?: boolean;
  status?: 'active' | 'inactive';
}

export interface CustomFieldListParams {
  module?: CustomFieldModule;
  status?: 'active' | 'inactive';
  showInList?: boolean;
  showInFilters?: boolean;
}

class CustomFieldService {
  async create(tenantId: string, data: CreateCustomFieldInput, createdBy: string) {
    // Check if field key already exists for this module
    const existing = await collections.customFields.findOne({
      tenantId: new ObjectId(tenantId),
      module: data.module,
      fieldKey: data.fieldKey,
    });

    if (existing) {
      throw new ApiError(
        'FIELD_KEY_EXISTS',
        `A field with key "${data.fieldKey}" already exists for this module`,
        409
      );
    }

    // Get the next display order
    const lastField = await collections.customFields.findOne(
      {
        tenantId: new ObjectId(tenantId),
        module: data.module,
      },
      { sort: { displayOrder: -1 } }
    );

    const displayOrder = lastField ? lastField.displayOrder + 1 : 1;
    const fieldId = new ObjectId();
    const now = new Date();

    const field: CustomFieldDocument = {
      _id: fieldId,
      tenantId: new ObjectId(tenantId),
      module: data.module,
      fieldName: data.fieldName,
      fieldKey: data.fieldKey,
      fieldType: data.fieldType,
      options: data.options,
      required: data.required || false,
      validation: data.validation,
      placeholder: data.placeholder,
      helpText: data.helpText,
      displayOrder,
      showInList: data.showInList || false,
      showInFilters: data.showInFilters || false,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.customFields.insertOne(field);

    logger.info(
      { fieldId: fieldId.toString(), module: data.module, fieldKey: data.fieldKey, tenantId },
      'Custom field created'
    );

    return this.formatField(field as WithId<CustomFieldDocument>);
  }

  async findById(tenantId: string, fieldId: string) {
    const field = (await collections.customFields.findOne({
      _id: new ObjectId(fieldId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CustomFieldDocument> | null;

    if (!field) {
      throw new ApiError('FIELD_NOT_FOUND', 'Custom field not found', 404);
    }

    return this.formatField(field);
  }

  async findAll(tenantId: string, params: CustomFieldListParams = {}) {
    const { module, status, showInList, showInFilters } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (module) {
      filter.module = module;
    }

    if (status) {
      filter.status = status;
    }

    if (showInList !== undefined) {
      filter.showInList = showInList;
    }

    if (showInFilters !== undefined) {
      filter.showInFilters = showInFilters;
    }

    const fields = (await collections.customFields
      .find(filter)
      .sort({ module: 1, displayOrder: 1 })
      .toArray()) as WithId<CustomFieldDocument>[];

    // Group by module
    const groupedFields: Record<string, ReturnType<typeof this.formatField>[]> = {};

    fields.forEach((field) => {
      if (!groupedFields[field.module]) {
        groupedFields[field.module] = [];
      }
      groupedFields[field.module].push(this.formatField(field));
    });

    return {
      fields: fields.map((f) => this.formatField(f)),
      byModule: groupedFields,
      total: fields.length,
    };
  }

  async getByModule(tenantId: string, module: CustomFieldModule, activeOnly = true) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      module,
    };

    if (activeOnly) {
      filter.status = 'active';
    }

    const fields = (await collections.customFields
      .find(filter)
      .sort({ displayOrder: 1 })
      .toArray()) as WithId<CustomFieldDocument>[];

    return fields.map((f) => this.formatField(f));
  }

  async update(tenantId: string, fieldId: string, data: UpdateCustomFieldInput, updatedBy: string) {
    const existing = await collections.customFields.findOne({
      _id: new ObjectId(fieldId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('FIELD_NOT_FOUND', 'Custom field not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.fieldName !== undefined) {
      updateData.fieldName = data.fieldName;
    }

    if (data.fieldType !== undefined) {
      updateData.fieldType = data.fieldType;
    }

    if (data.options !== undefined) {
      updateData.options = data.options;
    }

    if (data.required !== undefined) {
      updateData.required = data.required;
    }

    if (data.validation !== undefined) {
      updateData.validation = data.validation;
    }

    if (data.placeholder !== undefined) {
      updateData.placeholder = data.placeholder;
    }

    if (data.helpText !== undefined) {
      updateData.helpText = data.helpText;
    }

    if (data.showInList !== undefined) {
      updateData.showInList = data.showInList;
    }

    if (data.showInFilters !== undefined) {
      updateData.showInFilters = data.showInFilters;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    await collections.customFields.updateOne({ _id: new ObjectId(fieldId) }, { $set: updateData });

    logger.info({ fieldId, tenantId, updatedBy }, 'Custom field updated');

    return this.findById(tenantId, fieldId);
  }

  async delete(tenantId: string, fieldId: string, deletedBy: string) {
    const result = await collections.customFields.deleteOne({
      _id: new ObjectId(fieldId),
      tenantId: new ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('FIELD_NOT_FOUND', 'Custom field not found', 404);
    }

    logger.info({ fieldId, tenantId, deletedBy }, 'Custom field deleted');

    return { deleted: true };
  }

  async reorder(
    tenantId: string,
    module: CustomFieldModule,
    fieldOrder: string[],
    reorderedBy: string
  ) {
    // Verify all fields exist and belong to this module
    const fields = await collections.customFields
      .find({
        tenantId: new ObjectId(tenantId),
        module,
        _id: { $in: fieldOrder.map((id) => new ObjectId(id)) },
      })
      .toArray();

    if (fields.length !== fieldOrder.length) {
      throw new ApiError('INVALID_FIELDS', 'One or more field IDs are invalid', 400);
    }

    // Update display order for each field
    const bulkOps = fieldOrder.map((fieldId, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(fieldId) },
        update: {
          $set: {
            displayOrder: index + 1,
            updatedAt: new Date(),
          },
        },
      },
    }));

    await collections.customFields.bulkWrite(bulkOps);

    logger.info({ module, tenantId, reorderedBy }, 'Custom fields reordered');

    return this.getByModule(tenantId, module);
  }

  private formatField(field: WithId<CustomFieldDocument>) {
    return {
      _id: field._id.toString(),
      tenantId: field.tenantId.toString(),
      module: field.module,
      fieldName: field.fieldName,
      fieldKey: field.fieldKey,
      fieldType: field.fieldType,
      options: field.options,
      required: field.required,
      validation: field.validation,
      placeholder: field.placeholder,
      helpText: field.helpText,
      displayOrder: field.displayOrder,
      showInList: field.showInList,
      showInFilters: field.showInFilters,
      status: field.status,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    };
  }
}

export const customFieldService = new CustomFieldService();
