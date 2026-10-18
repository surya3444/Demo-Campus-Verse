import { ObjectId, type Document } from 'mongodb';
import type { SaveClubInput } from '@campus-verse/shared/schemas';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';

/**
 * Campus clubs. Members are students or staff, identified by their login
 * (userId) so "join" works from anyone's own account; name, photo and a
 * subtitle are snapshotted for fast directory cards.
 */

const nameOf = (p?: Document | null) =>
  (p?.displayName as string) || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Member';

const shortClass = (s?: string) => (s ?? '').split(' · ').slice(-2).join(' · ');

function formatClub(c: Document, extra: Record<string, unknown> = {}) {
  return {
    _id: String(c._id),
    name: c.name as string,
    category: c.category as string,
    tagline: (c.tagline as string) ?? '',
    description: (c.description as string) ?? '',
    emoji: (c.emoji as string) ?? '',
    icon: (c.icon as string) ?? '',
    theme: c.theme as string,
    institutionId: c.institutionId ? String(c.institutionId) : null,
    institutionName: (c.institutionName as string) ?? null,
    coordinator: c.coordinatorStaffId
      ? {
          staffId: String(c.coordinatorStaffId),
          name: c.coordinatorName as string,
          photo: c.coordinatorPhoto ?? null,
        }
      : null,
    meeting: (c.meeting as Record<string, string>) ?? {},
    tags: (c.tags as string[]) ?? [],
    highlights: (c.highlights as string[]) ?? [],
    memberCount: (c.memberCount as number) ?? 0,
    createdAt: c.createdAt as Date,
    ...extra,
  };
}

class ClubsService {
  private base(tenantId: string, branchId: string) {
    return { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId), status: 'active' };
  }

  async list(
    tenantId: string,
    branchId: string,
    userId: string,
    q: { search?: string; category?: string; mine?: boolean }
  ) {
    const filter: Document = this.base(tenantId, branchId);
    if (q.category) filter.category = q.category;
    if (q.search) {
      const rx = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [{ name: rx }, { tagline: rx }, { tags: rx }];
    }
    const mineIds = new Set(
      (
        await collections.clubMembers
          .find({ tenantId: new ObjectId(tenantId), userId: new ObjectId(userId) })
          .project({ clubId: 1 })
          .toArray()
      ).map((m) => String(m.clubId))
    );
    if (q.mine) filter._id = { $in: [...mineIds].map((id) => new ObjectId(id)) };

    const clubs = await collections.clubs
      .find(filter)
      .sort({ memberCount: -1, name: 1, _id: 1 })
      .toArray();
    // A few faces per card.
    const preview = await collections.clubMembers
      .aggregate([
        { $match: { clubId: { $in: clubs.map((c) => c._id) }, photo: { $nin: [null, ''] } } },
        { $sort: { role: 1, joinedAt: 1 } },
        { $group: { _id: '$clubId', people: { $push: { name: '$name', photo: '$photo' } } } },
        { $project: { people: { $slice: ['$people', 5] } } },
      ])
      .toArray();
    const faces = new Map(preview.map((p) => [String(p._id), p.people]));
    return clubs.map((c) =>
      formatClub(c, { isMember: mineIds.has(String(c._id)), faces: faces.get(String(c._id)) ?? [] })
    );
  }

  async get(tenantId: string, branchId: string, userId: string, id: string) {
    const club = await collections.clubs.findOne({
      _id: new ObjectId(id),
      ...this.base(tenantId, branchId),
    });
    if (!club) throw new ApiError('CLUB_NOT_FOUND', 'Club not found', 404);
    const members = await collections.clubMembers
      .find({ clubId: club._id })
      .sort({ role: 1, joinedAt: 1, _id: 1 })
      .limit(300)
      .toArray();
    return formatClub(club, {
      isMember: members.some((m) => String(m.userId) === userId),
      members: members.map((m) => ({
        _id: String(m._id),
        name: m.name,
        photo: m.photo ?? null,
        subtitle: m.subtitle ?? '',
        kind: m.kind,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  }

  private async snapshot(tenantId: string, data: SaveClubInput) {
    const extra: Document = {};
    if (data.coordinatorStaffId !== undefined) {
      const staff = data.coordinatorStaffId
        ? await collections.staff.findOne({
            _id: new ObjectId(data.coordinatorStaffId),
            tenantId: new ObjectId(tenantId),
          })
        : null;
      if (data.coordinatorStaffId && !staff)
        throw new ApiError('STAFF_NOT_FOUND', 'Coordinator not found', 404);
      extra.coordinatorStaffId = staff?._id ?? null;
      extra.coordinatorName = staff ? nameOf(staff) : null;
      extra.coordinatorPhoto = staff?.photo ?? null;
    }
    if (data.institutionId !== undefined) {
      const inst = data.institutionId
        ? await collections.institutions.findOne({
            _id: new ObjectId(data.institutionId),
            tenantId: new ObjectId(tenantId),
          })
        : null;
      extra.institutionId = inst?._id ?? null;
      extra.institutionName = (inst?.name as string) ?? null;
    }
    return extra;
  }

  async create(tenantId: string, branchId: string, userId: string, data: SaveClubInput) {
    const now = new Date();
    const { coordinatorStaffId: _c, institutionId: _i, ...rest } = data;
    const doc = {
      _id: new ObjectId(),
      ...this.base(tenantId, branchId),
      ...rest,
      ...(await this.snapshot(tenantId, data)),
      memberCount: 0,
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };
    await collections.clubs.insertOne(doc);
    return formatClub(doc, { isMember: false, faces: [] });
  }

  async update(tenantId: string, branchId: string, id: string, data: SaveClubInput) {
    const { coordinatorStaffId: _c, institutionId: _i, ...rest } = data;
    const r = await collections.clubs.findOneAndUpdate(
      { _id: new ObjectId(id), ...this.base(tenantId, branchId) },
      { $set: { ...rest, ...(await this.snapshot(tenantId, data)), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!r) throw new ApiError('CLUB_NOT_FOUND', 'Club not found', 404);
    return formatClub(r);
  }

  /** The signed-in person as a club member (student or staff). */
  private async whoAmI(tenantId: string, userId: string) {
    const tenantOid = new ObjectId(tenantId);
    const userOid = new ObjectId(userId);
    const student = await collections.students.findOne({ tenantId: tenantOid, userId: userOid });
    if (student) {
      const enr = (student.currentEnrollment ?? {}) as { className?: string; sectionName?: string };
      return {
        kind: 'student',
        personId: student._id,
        name: nameOf(student),
        photo: student.photo ?? null,
        subtitle: [shortClass(enr.className), enr.sectionName && `Sec ${enr.sectionName}`]
          .filter(Boolean)
          .join(' · '),
      };
    }
    const staff = await collections.staff.findOne({ tenantId: tenantOid, userId: userOid });
    if (staff)
      return {
        kind: 'staff',
        personId: staff._id,
        name: nameOf(staff),
        photo: staff.photo ?? null,
        subtitle: 'Faculty & staff',
      };
    const user = await collections.users.findOne({ _id: userOid, tenantId: tenantOid });
    return {
      kind: 'staff',
      personId: null,
      name: nameOf(user?.profile ?? user),
      photo: null,
      subtitle: 'Leadership',
    };
  }

  private async recount(clubId: ObjectId) {
    const n = await collections.clubMembers.countDocuments({ clubId });
    await collections.clubs.updateOne({ _id: clubId }, { $set: { memberCount: n } });
    return n;
  }

  async join(tenantId: string, branchId: string, userId: string, id: string) {
    const club = await collections.clubs.findOne({
      _id: new ObjectId(id),
      ...this.base(tenantId, branchId),
    });
    if (!club) throw new ApiError('CLUB_NOT_FOUND', 'Club not found', 404);
    const me = await this.whoAmI(tenantId, userId);
    await collections.clubMembers.updateOne(
      { clubId: club._id, userId: new ObjectId(userId) },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          tenantId: club.tenantId,
          clubId: club._id,
          userId: new ObjectId(userId),
          ...me,
          role: 'member',
          joinedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return { memberCount: await this.recount(club._id), isMember: true };
  }

  async leave(tenantId: string, branchId: string, userId: string, id: string) {
    const club = await collections.clubs.findOne({
      _id: new ObjectId(id),
      ...this.base(tenantId, branchId),
    });
    if (!club) throw new ApiError('CLUB_NOT_FOUND', 'Club not found', 404);
    await collections.clubMembers.deleteOne({ clubId: club._id, userId: new ObjectId(userId) });
    return { memberCount: await this.recount(club._id), isMember: false };
  }

  /** Coordinators add students/staff in bulk (people without logins are skipped). */
  async addMembers(
    tenantId: string,
    branchId: string,
    id: string,
    data: { studentIds?: string[]; staffIds?: string[]; role: 'member' | 'lead' }
  ) {
    const club = await collections.clubs.findOne({
      _id: new ObjectId(id),
      ...this.base(tenantId, branchId),
    });
    if (!club) throw new ApiError('CLUB_NOT_FOUND', 'Club not found', 404);
    const tenantOid = new ObjectId(tenantId);
    const [students, staff] = await Promise.all([
      data.studentIds?.length
        ? collections.students
            .find({
              tenantId: tenantOid,
              _id: { $in: data.studentIds.map((s) => new ObjectId(s)) },
            })
            .toArray()
        : [],
      data.staffIds?.length
        ? collections.staff
            .find({ tenantId: tenantOid, _id: { $in: data.staffIds.map((s) => new ObjectId(s)) } })
            .toArray()
        : [],
    ]);
    const now = new Date();
    const people = [
      ...students.map((s) => {
        const enr = (s.currentEnrollment ?? {}) as { className?: string; sectionName?: string };
        return {
          userId: s.userId,
          kind: 'student',
          personId: s._id,
          name: nameOf(s),
          photo: s.photo ?? null,
          subtitle: [shortClass(enr.className), enr.sectionName && `Sec ${enr.sectionName}`]
            .filter(Boolean)
            .join(' · '),
        };
      }),
      ...staff.map((s) => ({
        userId: s.userId,
        kind: 'staff',
        personId: s._id,
        name: nameOf(s),
        photo: s.photo ?? null,
        subtitle: 'Faculty & staff',
      })),
    ].filter((p) => p.userId);
    if (people.length) {
      await collections.clubMembers.bulkWrite(
        people.map((p) => ({
          updateOne: {
            filter: { clubId: club._id, userId: p.userId },
            update: {
              $setOnInsert: {
                _id: new ObjectId(),
                tenantId: tenantOid,
                clubId: club._id,
                joinedAt: now,
              },
              $set: { ...p, role: data.role },
            },
            upsert: true,
          },
        }))
      );
    }
    return { added: people.length, memberCount: await this.recount(club._id) };
  }
}

export const clubsService = new ClubsService();
