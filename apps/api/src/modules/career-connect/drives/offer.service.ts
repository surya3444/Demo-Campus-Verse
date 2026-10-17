import { ObjectId, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';

class OfferService {
  async createOffer(
    tenantId: string,
    branchId: string,
    userId: string,
    data: Record<string, unknown>
  ) {
    const now = new Date();

    // Validate drive exists
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(data.driveId as string),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    // Validate student was registered
    const studentRegistered = (drive.registrations as Array<Record<string, unknown>>)?.some(
      (r) => (r.studentId as ObjectId).toString() === (data.studentId as string)
    );

    if (!studentRegistered) {
      throw new ApiError('STUDENT_NOT_REGISTERED', 'Student is not registered for this drive', 400);
    }

    const doc = {
      ...data,
      driveId: new ObjectId(data.driveId as string),
      studentId: new ObjectId(data.studentId as string),
      companyId: drive.companyId,
      companyName: drive.companyName,
      driveTitle: drive.title,
      status: 'offered',
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.placementOffers.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async getOffersByDrive(tenantId: string, driveId: string) {
    const offers = await collections.placementOffers
      .find({
        tenantId: new ObjectId(tenantId),
        driveId: new ObjectId(driveId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return offers.map(this.formatOffer);
  }

  async getOffersByStudent(tenantId: string, studentId: string) {
    const offers = await collections.placementOffers
      .find({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return offers.map(this.formatOffer);
  }

  async respondToOffer(tenantId: string, offerId: string, userId: string, status: string) {
    const offer = await collections.placementOffers.findOne({
      _id: new ObjectId(offerId),
      tenantId: new ObjectId(tenantId),
    });

    if (!offer) {
      throw new ApiError('OFFER_NOT_FOUND', 'Offer not found', 404);
    }

    if (offer.status !== 'offered') {
      throw new ApiError(
        'OFFER_ALREADY_RESPONDED',
        'This offer has already been responded to',
        400
      );
    }

    if (!['accepted', 'declined'].includes(status)) {
      throw new ApiError('INVALID_STATUS', 'Status must be accepted or declined', 400);
    }

    await collections.placementOffers.updateOne(
      { _id: new ObjectId(offerId) },
      {
        $set: {
          status,
          respondedBy: new ObjectId(userId),
          respondedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (status === 'accepted') {
      // Update student career profile placement status
      await collections.studentCareerProfiles.updateOne(
        {
          studentId: offer.studentId,
          tenantId: new ObjectId(tenantId),
        },
        {
          $set: {
            placementStatus: 'placed',
            updatedAt: new Date(),
          },
        }
      );

      // Update drive stats
      await this.updateDriveStats(tenantId, (offer.driveId as ObjectId).toString());
    }

    return this.getById(tenantId, offerId);
  }

  async getById(tenantId: string, id: string) {
    const offer = await collections.placementOffers.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!offer) {
      throw new ApiError('OFFER_NOT_FOUND', 'Offer not found', 404);
    }

    return this.formatOffer(offer);
  }

  private async updateDriveStats(tenantId: string, driveId: string) {
    const acceptedOffers = await collections.placementOffers
      .find({
        driveId: new ObjectId(driveId),
        tenantId: new ObjectId(tenantId),
        status: 'accepted',
      })
      .toArray();

    const totalPlaced = acceptedOffers.length;
    const ctcValues = acceptedOffers.map((o) => o.ctc as number).filter((c) => c != null && c > 0);

    const highestCTC = ctcValues.length > 0 ? Math.max(...ctcValues) : 0;
    const averageCTC =
      ctcValues.length > 0
        ? Math.round((ctcValues.reduce((a, b) => a + b, 0) / ctcValues.length) * 100) / 100
        : 0;

    await collections.placementDrives.updateOne(
      { _id: new ObjectId(driveId) },
      {
        $set: {
          'stats.totalPlaced': totalPlaced,
          'stats.highestCTC': highestCTC,
          'stats.averageCTC': averageCTC,
          updatedAt: new Date(),
        },
      }
    );
  }

  private formatOffer(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      driveId: doc.driveId?.toString(),
      studentId: doc.studentId?.toString(),
      companyId: doc.companyId?.toString(),
      createdBy: doc.createdBy?.toString(),
      respondedBy: doc.respondedBy?.toString(),
    };
  }
}

export const offerService = new OfferService();
