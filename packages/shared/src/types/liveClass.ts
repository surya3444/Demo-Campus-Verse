import { BaseEntity } from './common';

export type LiveClassStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type LiveClassRole = 'host' | 'cohost' | 'student';
export type LiveClassPollStatus = 'live' | 'closed' | 'revealed';
export type LiveClassPollType = 'single' | 'multi';

export interface LiveClass extends BaseEntity {
  branchId: string;
  title: string;
  description?: string;
  classId?: string;
  sectionId: string;
  subjectId?: string;
  hostStaffId: string;
  hostName?: string;
  coHostStaffIds?: string[];
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  status: LiveClassStatus;
  provider: 'livekit';
  providerRoomName: string;
  recordingUrl?: string;
  recordingStatus?: 'pending' | 'ready' | 'failed';
  recordingEnabled?: boolean;
  autoMarkAttendance?: boolean;
  attendanceThresholdPct?: number;
  attendanceMarkedAt?: Date;
  settings?: {
    chatEnabled?: boolean;
    studentCanUnmute?: boolean;
    studentCanDraw?: boolean;
    recordingEnabled?: boolean;
  };
  // Denormalised
  className?: string;
  sectionName?: string;
  subjectName?: string;
  // Authorship
  scheduledByUserId?: string;
  /**
   * True when an administrator scheduled this class on behalf of a different
   * teacher. The host can still start/end/run the class, but cannot edit
   * metadata, cancel, or change settings — only an admin can.
   */
  lockedForHost?: boolean;
}

export interface LiveClassParticipant {
  _id: string;
  tenantId: string;
  liveClassId: string;
  userId: string;
  studentId?: string;
  staffId?: string;
  role: LiveClassRole;
  displayName?: string;
  joinedAt: Date;
  leftAt?: Date;
  lastSeenAt?: Date;
  totalDurationSec?: number;
}

export interface LiveClassMessage {
  _id: string;
  tenantId: string;
  liveClassId: string;
  senderUserId: string;
  senderName: string;
  senderRole: LiveClassRole;
  text: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface LiveClassPollOption {
  text: string;
  isCorrect?: boolean;
}

export interface LiveClassPoll {
  _id: string;
  tenantId: string;
  liveClassId: string;
  createdByUserId: string;
  question: string;
  options: LiveClassPollOption[];
  type: LiveClassPollType;
  durationSec: number;
  launchedAt: Date;
  closesAt: Date;
  closedAt?: Date;
  revealedAt?: Date;
  status: LiveClassPollStatus;
}

export interface LiveClassPollResults {
  pollId: string;
  totalResponses: number;
  results: { text: string; isCorrect: boolean; count: number }[];
}

export interface LiveClassJoinResponse {
  liveClassId: string;
  livekitUrl: string;
  livekitToken: string;
  socketUrl: string;
  role: LiveClassRole;
  identity: string;
  displayName: string;
}
