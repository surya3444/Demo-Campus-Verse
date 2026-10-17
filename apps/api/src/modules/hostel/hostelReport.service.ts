import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';

class HostelReportService {
  async getOccupancyReport(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Get all active hostels
    const hostels = await collections.hostels
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        status: 'active',
      })
      .sort({ name: 1 })
      .toArray();

    const report = [];

    for (const hostel of hostels) {
      const hostelId = hostel._id as ObjectId;

      // Get floor-wise breakdown from rooms collection
      const floorBreakdown = await collections.rooms
        .aggregate([
          {
            $match: {
              tenantId: tenantObjId,
              hostelId,
            },
          },
          {
            $group: {
              _id: '$floor',
              totalRooms: { $sum: 1 },
              totalBeds: { $sum: '$capacity' },
              occupiedBeds: { $sum: '$occupiedBeds' },
              availableBeds: { $sum: '$availableBeds' },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      const totalBeds = (hostel.totalBeds as number) || 0;
      const occupiedBeds = (hostel.occupiedBeds as number) || 0;
      const availableBeds = (hostel.availableBeds as number) || 0;

      report.push({
        hostelId: hostelId.toString(),
        hostelName: hostel.name as string,
        type: hostel.type as string,
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        floors: floorBreakdown.map((f) => ({
          floor: f._id as string,
          totalRooms: f.totalRooms as number,
          totalBeds: f.totalBeds as number,
          occupiedBeds: f.occupiedBeds as number,
          availableBeds: f.availableBeds as number,
        })),
      });
    }

    return report;
  }

  async getVacancyReport(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Get rooms with available beds, grouped by hostel
    const rooms = await collections.rooms
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
            availableBeds: { $gt: 0 },
            roomStatus: { $nin: ['maintenance', 'reserved'] },
          },
        },
        {
          $group: {
            _id: '$hostelId',
            hostelName: { $first: '$hostelName' },
            rooms: {
              $push: {
                roomId: '$_id',
                roomNumber: '$roomNumber',
                floor: '$floor',
                type: '$type',
                capacity: '$capacity',
                occupiedBeds: '$occupiedBeds',
                availableBeds: '$availableBeds',
                roomStatus: '$roomStatus',
              },
            },
            totalAvailableBeds: { $sum: '$availableBeds' },
          },
        },
        { $sort: { hostelName: 1 } },
      ])
      .toArray();

    return rooms.map((group) => ({
      hostelId: (group._id as ObjectId).toString(),
      hostelName: group.hostelName as string,
      totalAvailableBeds: group.totalAvailableBeds as number,
      rooms: (group.rooms as Array<Record<string, unknown>>).map((r) => ({
        roomId: (r.roomId as ObjectId).toString(),
        roomNumber: r.roomNumber as string,
        floor: r.floor as string,
        type: r.type as string,
        capacity: r.capacity as number,
        occupiedBeds: r.occupiedBeds as number,
        availableBeds: r.availableBeds as number,
        roomStatus: r.roomStatus as string,
      })),
    }));
  }

  async getClassWiseReport(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Aggregate bed_allocations by classId
    const classAllocations = await collections.bedAllocations
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
            status: 'active',
          },
        },
        {
          $group: {
            _id: '$classId',
            className: { $first: '$className' },
            hostelStudents: { $sum: 1 },
          },
        },
        { $sort: { className: 1 } },
      ])
      .toArray();

    // For each class, get total student count from enrollments
    const report = [];

    for (const allocation of classAllocations) {
      const classId = allocation._id as ObjectId | null;

      let totalStudents = 0;
      if (classId) {
        totalStudents = await collections.studentEnrollments.countDocuments({
          tenantId: tenantObjId,
          branchId: branchObjId,
          classId,
          status: 'active',
        });
      }

      const hostelStudents = allocation.hostelStudents as number;

      report.push({
        classId: classId?.toString() || 'unassigned',
        className: (allocation.className as string) || 'Unassigned',
        totalStudents,
        hostelStudents,
        percentage: totalStudents > 0 ? Math.round((hostelStudents / totalStudents) * 100) : 0,
      });
    }

    return report;
  }
}

export const hostelReportService = new HostelReportService();
