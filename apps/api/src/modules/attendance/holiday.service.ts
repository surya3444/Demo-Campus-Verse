import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface HolidayDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  name: string;
  date: Date;
  endDate?: Date;
  type: 'national' | 'religious' | 'local' | 'vacation';
  description?: string;
  applicableFor: 'all' | 'students' | 'staff';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHolidayInput {
  name: string;
  date: string;
  endDate?: string;
  type: 'national' | 'religious' | 'local' | 'vacation';
  description?: string;
  applicableFor?: 'all' | 'students' | 'staff';
}

export interface UpdateHolidayInput {
  name?: string;
  date?: string;
  endDate?: string;
  type?: 'national' | 'religious' | 'local' | 'vacation';
  description?: string;
  applicableFor?: 'all' | 'students' | 'staff';
}

export interface HolidayListParams {
  year?: number;
  type?: string;
  applicableFor?: string;
  upcoming?: boolean;
}

class HolidayService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateHolidayInput,
    createdBy: string
  ) {
    const holidayDate = new Date(data.date);
    holidayDate.setHours(0, 0, 0, 0);

    // Check for duplicate holiday on same date
    const existing = await this.findByDate(tenantId, branchId, data.date);
    if (existing) {
      throw new ApiError('HOLIDAY_EXISTS', 'A holiday already exists on this date', 400);
    }

    const now = new Date();
    const holidayId = new ObjectId();

    const holiday: HolidayDocument = {
      _id: holidayId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      name: data.name,
      date: holidayDate,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      type: data.type,
      description: data.description,
      applicableFor: data.applicableFor || 'all',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.holidays.insertOne(holiday);

    logger.info({ holidayId: holidayId.toString(), name: data.name }, 'Holiday created');

    return this.formatHoliday(holiday);
  }

  async findAll(tenantId: string, branchId: string, params: HolidayListParams = {}) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (params.year) {
      const startOfYear = new Date(params.year, 0, 1);
      const endOfYear = new Date(params.year, 11, 31, 23, 59, 59);
      filter.date = { $gte: startOfYear, $lte: endOfYear };
    }

    if (params.type) {
      filter.type = params.type;
    }

    if (params.applicableFor) {
      filter.applicableFor = params.applicableFor;
    }

    if (params.upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.date = { ...((filter.date as object) || {}), $gte: today };
    }

    const holidays = await collections.holidays
      .find(filter)
      .sort({ date: 1 })
      .toArray();

    return holidays.map((h) => this.formatHoliday(h as WithId<HolidayDocument>));
  }

  async findById(tenantId: string, holidayId: string) {
    const holiday = await collections.holidays.findOne({
      _id: new ObjectId(holidayId),
      tenantId: new ObjectId(tenantId),
    });

    if (!holiday) {
      throw new ApiError('HOLIDAY_NOT_FOUND', 'Holiday not found', 404);
    }

    return this.formatHoliday(holiday as WithId<HolidayDocument>);
  }

  async findByDate(tenantId: string, branchId: string, date: string) {
    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    const holiday = await collections.holidays.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      date: holidayDate,
    });

    return holiday ? this.formatHoliday(holiday as WithId<HolidayDocument>) : null;
  }

  async update(tenantId: string, holidayId: string, data: UpdateHolidayInput) {
    const existing = await collections.holidays.findOne({
      _id: new ObjectId(holidayId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('HOLIDAY_NOT_FOUND', 'Holiday not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.date !== undefined) {
      const holidayDate = new Date(data.date);
      holidayDate.setHours(0, 0, 0, 0);
      updateData.date = holidayDate;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.applicableFor !== undefined) updateData.applicableFor = data.applicableFor;

    await collections.holidays.updateOne(
      { _id: new ObjectId(holidayId) },
      { $set: updateData }
    );

    logger.info({ holidayId }, 'Holiday updated');

    return this.findById(tenantId, holidayId);
  }

  async delete(tenantId: string, holidayId: string) {
    const result = await collections.holidays.deleteOne({
      _id: new ObjectId(holidayId),
      tenantId: new ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('HOLIDAY_NOT_FOUND', 'Holiday not found', 404);
    }

    logger.info({ holidayId }, 'Holiday deleted');

    return { success: true };
  }

  async getStats(tenantId: string, branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const holidays = await collections.holidays
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        date: { $gte: startOfYear, $lte: endOfYear },
      })
      .toArray();

    const total = holidays.length;
    const upcoming = holidays.filter((h) => new Date(h.date) >= today).length;
    const national = holidays.filter((h) => h.type === 'national').length;
    const vacation = holidays.filter((h) => h.type === 'vacation').length;

    return {
      total,
      upcoming,
      national,
      vacation,
    };
  }

  private formatHoliday(holiday: WithId<HolidayDocument>) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const holidayDate = new Date(holiday.date);

    let status: 'upcoming' | 'ongoing' | 'past' = 'past';
    if (holiday.endDate) {
      const endDate = new Date(holiday.endDate);
      if (holidayDate <= today && today <= endDate) {
        status = 'ongoing';
      } else if (holidayDate > today) {
        status = 'upcoming';
      }
    } else {
      if (holidayDate > today) {
        status = 'upcoming';
      } else if (holidayDate.getTime() === today.getTime()) {
        status = 'ongoing';
      }
    }

    return {
      _id: holiday._id.toString(),
      branchId: holiday.branchId.toString(),
      name: holiday.name,
      date: holiday.date.toISOString().split('T')[0],
      endDate: holiday.endDate ? holiday.endDate.toISOString().split('T')[0] : undefined,
      type: holiday.type,
      description: holiday.description,
      applicableFor: holiday.applicableFor,
      status,
      createdAt: holiday.createdAt,
      updatedAt: holiday.updatedAt,
    };
  }
}

export const holidayService = new HolidayService();
