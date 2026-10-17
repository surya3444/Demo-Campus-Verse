import { Response, NextFunction, Request } from 'express';
import { bulkUploadService } from './bulkUpload.service';

class BulkUploadController {
  async uploadApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { academicBatchId, data } = req.body;

      if (!academicBatchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BATCH_REQUIRED', message: 'Academic batch ID is required' },
        });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'DATA_REQUIRED', message: 'Data array is required' },
        });
      }

      const result = await bulkUploadService.uploadApplications(
        tenantId!,
        branchId,
        academicBatchId,
        data,
        req.user!.userId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async uploadLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, branchId } = req;
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BRANCH_REQUIRED', message: 'Branch ID is required' },
        });
      }

      const { data } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'DATA_REQUIRED', message: 'Data array is required' },
        });
      }

      const result = await bulkUploadService.uploadLeads(
        tenantId!,
        branchId,
        data,
        req.user!.userId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationTemplate(_req: Request, res: Response) {
    const template = bulkUploadService.getApplicationTemplate();
    res.json({
      success: true,
      data: {
        columns: template,
        sample: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '2010-05-15',
          gender: 'male',
          bloodGroup: 'O+',
          nationality: 'Indian',
          religion: 'Hindu',
          caste: 'General',
          category: 'General',
          email: 'john.doe@example.com',
          phone: '9876543210',
          alternatePhone: '',
          street: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India',
          fatherName: 'Richard Doe',
          fatherPhone: '9876543211',
          fatherEmail: 'richard@example.com',
          fatherOccupation: 'Business',
          motherName: 'Jane Doe',
          motherPhone: '9876543212',
          motherEmail: 'jane@example.com',
          motherOccupation: 'Teacher',
          guardianName: '',
          guardianRelation: '',
          guardianPhone: '',
          previousSchool: 'ABC School',
          previousBoard: 'CBSE',
          previousClass: 'Class 5',
          previousPercentage: 85,
          yearOfPassing: 2024,
          tcNumber: 'TC12345',
          classCode: 'CLASS-6',
          className: 'Class 6',
          sectionCode: 'A',
          source: 'website',
          referredBy: '',
        },
      },
    });
  }

  async getLeadTemplate(_req: Request, res: Response) {
    const template = bulkUploadService.getLeadTemplate();
    res.json({
      success: true,
      data: {
        columns: template,
        sample: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          email: 'john.parent@example.com',
          parentName: 'Richard Doe',
          parentPhone: '9876543211',
          interestedClass: 'Class 6',
          interestedStream: 'Science',
          source: 'website',
          notes: 'Interested in admission for 2024-25',
        },
      },
    });
  }
}

export const bulkUploadController = new BulkUploadController();
