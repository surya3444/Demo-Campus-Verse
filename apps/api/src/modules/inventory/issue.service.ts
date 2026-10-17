import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export interface IssueListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class IssueService {
  async findAll(tenantId: string, branchId: string, params: IssueListParams) {
    try {
      const skip = (params.page - 1) * params.limit;

      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      };

      if (params.search) {
        filter.$or = [
          { assetName: { $regex: params.search, $options: 'i' } },
          { assetCode: { $regex: params.search, $options: 'i' } },
          { 'issuedTo.userName': { $regex: params.search, $options: 'i' } },
        ];
      }

      if (params.status) filter.status = params.status;
      if (params.userId) filter['issuedTo.userId'] = new ObjectId(params.userId);

      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        collections.assetIssues
          .find(filter)
          .sort({ [sortBy]: sortOrder, _id: sortOrder })
          .skip(skip)
          .limit(params.limit)
          .toArray(),
        collections.assetIssues.countDocuments(filter),
      ]);

      return {
        data: data.map((doc) => this.formatIssue(doc)),
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
          hasMore: skip + params.limit < total,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch asset issues');
      throw error;
    }
  }

  async getMyAssets(tenantId: string, branchId: string, userId: string) {
    try {
      const issues = await collections.assetIssues
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          'issuedTo.userId': new ObjectId(userId),
          status: 'issued',
        })
        .sort({ issueDate: -1 })
        .toArray();

      return issues.map((doc) => this.formatIssue(doc));
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch my assets');
      throw error;
    }
  }

  async issueAsset(
    tenantId: string,
    branchId: string,
    data: Record<string, unknown>,
    userId: string,
    userName: string
  ) {
    try {
      const assetId = data.assetId as string;

      // Verify asset exists and is available
      const asset = await collections.assets.findOne({
        _id: new ObjectId(assetId),
        tenantId: new ObjectId(tenantId),
      });

      if (!asset) {
        throw new ApiError('NOT_FOUND', 'Asset not found', 404);
      }

      if (asset.status !== 'available') {
        throw new ApiError(
          'ASSET_NOT_AVAILABLE',
          `Asset is currently ${asset.status} and cannot be issued`,
          400
        );
      }

      const issuedTo = data.issuedTo as Record<string, unknown>;
      const now = new Date();

      // Create the issue record
      const result = await collections.assetIssues.insertOne({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        assetId: new ObjectId(assetId),
        assetCode: asset.assetCode,
        assetName: asset.name,
        issuedTo: {
          userId: new ObjectId(issuedTo.userId as string),
          userName: issuedTo.userName,
          department: issuedTo.department || null,
        },
        issuedBy: {
          userId: new ObjectId(userId),
          userName,
        },
        issueDate: data.issueDate ? new Date(data.issueDate as string) : now,
        expectedReturnDate: data.expectedReturnDate
          ? new Date(data.expectedReturnDate as string)
          : null,
        actualReturnDate: null,
        status: 'issued',
        conditionAtIssue: data.conditionAtIssue,
        conditionAtReturn: null,
        remarks: data.remarks || null,
        returnRemarks: null,
        createdAt: now,
        updatedAt: now,
      });

      // Update asset status and assignee
      await collections.assets.updateOne(
        { _id: new ObjectId(assetId) },
        {
          $set: {
            status: 'issued',
            assignedTo: {
              userId: new ObjectId(issuedTo.userId as string),
              userName: issuedTo.userName,
              type: 'staff',
            },
            updatedAt: now,
          },
        }
      );

      const issue = await collections.assetIssues.findOne({ _id: result.insertedId });
      return this.formatIssue(issue!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to issue asset');
      throw error;
    }
  }

  async returnAsset(tenantId: string, issueId: string, data: Record<string, unknown>) {
    try {
      const issue = await collections.assetIssues.findOne({
        _id: new ObjectId(issueId),
        tenantId: new ObjectId(tenantId),
      });

      if (!issue) {
        throw new ApiError('NOT_FOUND', 'Issue record not found', 404);
      }

      if (issue.status !== 'issued' && issue.status !== 'overdue') {
        throw new ApiError('INVALID_STATUS', 'This asset is not currently issued', 400);
      }

      const now = new Date();

      // Update issue record
      await collections.assetIssues.updateOne(
        { _id: new ObjectId(issueId) },
        {
          $set: {
            status: 'returned',
            actualReturnDate: now,
            conditionAtReturn: data.conditionAtReturn,
            returnRemarks: data.returnRemarks || null,
            updatedAt: now,
          },
        }
      );

      // Update asset — mark as available and clear assignee
      const newCondition = data.conditionAtReturn as string;
      await collections.assets.updateOne(
        { _id: issue.assetId },
        {
          $set: {
            status: 'available',
            condition: newCondition,
            assignedTo: null,
            updatedAt: now,
          },
        }
      );

      const updated = await collections.assetIssues.findOne({ _id: new ObjectId(issueId) });
      return this.formatIssue(updated!);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, 'Failed to return asset');
      throw error;
    }
  }

  private formatIssue(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      assetId: doc.assetId.toString(),
      issuedTo: {
        ...doc.issuedTo,
        userId: doc.issuedTo.userId.toString(),
      },
      issuedBy: {
        ...doc.issuedBy,
        userId: doc.issuedBy.userId.toString(),
      },
    };
  }
}

export const issueService = new IssueService();
