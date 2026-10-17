// API
export { apiClient, fetchApi, API_URL } from './api/client';
export type { ApiResponse, ApiError } from './api/client';
export { authApi } from './api/auth';
export type { LoginCredentials, AuthTokens, UserProfile, LoginResponse } from './api/auth';
export { announcementsApi } from './api/announcements';
export type { Announcement, Event } from './api/announcements';
export type { TimetableSlot, TimetableEntry, Assignment, PaginatedResponse } from './api/types';
export { hrApi } from './api/hr';
export type { LeaveRequest, LeaveBalance, PayslipSummary, PayslipDetail } from './api/hr';
export { feedApi } from './api/feed';
export type { FeedPost, FeedComment, FeedAuthor } from './api/feed';
export { coursesApi } from './api/courses';
export type { Course, CourseLesson, CourseQuiz, CourseEnrollment } from './api/courses';
export { holidaysApi } from './api/holidays';
export type { Holiday } from './api/holidays';
export { liveClassApi } from './api/liveClass';
export type {
  LiveClass,
  LiveClassStatus,
  LiveClassRole,
  LiveClassPollType,
  LiveClassJoinResponse,
} from './api/liveClass';
export { useLiveClassSocket } from './hooks/useLiveClassSocket';
// NOTE: LiveClassRoom is deliberately NOT re-exported from this barrel.
// It pulls @livekit/react-native at module-load time, which requires a
// native module that only exists in EAS dev builds. Re-exporting it here
// would crash every screen that touches `@campus-verse/mobile-shared`
// (login, change-password, dashboards, etc.) when running in Expo Go or
// any client missing the LiveKit native pod. Consumers that actually need
// the room must deep-import:
//   import { LiveClassRoom } from '@campus-verse/mobile-shared/components/liveClass/LiveClassRoom';
export { LiveClassChatPanel } from './components/liveClass/LiveClassChatPanel';
export { LiveClassPollPanel } from './components/liveClass/LiveClassPollPanel';
export { LiveClassReactionOverlay } from './components/liveClass/LiveClassReactionOverlay';
export type {
  ChatMessage,
  CurrentPoll,
  PollResults,
  RaisedHand,
  ReactionBurst,
  LiveClassSocketState,
} from './hooks/useLiveClassSocket';
export { feedbackApi } from './api/feedback';
export type {
  FeedbackTicket,
  FeedbackResponse,
  FeedbackSatisfaction,
  FeedbackStats,
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackListParams,
} from './api/feedback';

// Store
export {
  useAuthStore,
  useIsParent,
  useIsStudent,
  useCurrentUser,
  useSelectedChild,
  useChildren,
} from './store/authStore';
export type { Child } from './store/authStore';

// Hooks
export { useIsStaff, useCurrentStudentId, useStudentInfo } from './hooks/useAuth';
export { useBiometrics, getBiometricLabel } from './hooks/useBiometrics';

// Services
export { secureStorage } from './services/secureStorage';
export { biometricService } from './services/biometricService';
export type { BiometricType } from './services/biometricService';
export { notificationService } from './services/notificationService';
export type { PushToken } from './services/notificationService';

// Design system — Almanac aesthetic
export * from './design';
