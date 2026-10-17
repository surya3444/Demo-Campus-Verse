# Mobile App Requirements

This document outlines the mobile application requirements for Campus Verse.

---

## Overview

### App Types
1. **Student/Parent App** - Primary user-facing app
2. **Teacher App** - For teachers and staff
3. **Admin App** - For administrators (optional, can use web)

### Technology Stack
- **Framework**: React Native with Expo
- **State Management**: Zustand + TanStack Query
- **Navigation**: Expo Router
- **UI Components**: NativeWind (Tailwind for RN)
- **Push Notifications**: Expo Notifications + FCM/APNs

---

## 1. Student/Parent App

### Authentication
| Feature | Description | Priority |
|---------|-------------|----------|
| Phone OTP Login | Login via registered phone | High |
| Email/Password | Alternative login method | Medium |
| Biometric Auth | Face ID / Fingerprint | Medium |
| Multiple Children | Switch between children | High |
| Remember Device | Stay logged in | High |

### Dashboard
| Feature | Description | Priority |
|---------|-------------|----------|
| Today's Summary | Attendance, homework, notices | High |
| Quick Actions | Fee payment, leave, PTM | High |
| Upcoming Events | Calendar preview | Medium |
| Notifications Bell | Unread count + list | High |

### Attendance
| Feature | Description | Priority |
|---------|-------------|----------|
| Today's Status | Present/Absent indicator | High |
| Monthly Calendar | Color-coded attendance view | High |
| Attendance % | Overall and subject-wise | High |
| Leave History | Applied leaves with status | Medium |

### Academics
| Feature | Description | Priority |
|---------|-------------|----------|
| Timetable | Weekly class schedule | High |
| Homework/Diary | Daily assignments | High |
| Exam Schedule | Upcoming exams | High |
| Results | View report cards | High |
| Syllabus | Subject-wise syllabus | Medium |

### Finance
| Feature | Description | Priority |
|---------|-------------|----------|
| Fee Summary | Paid, pending, overdue | High |
| Pay Now | Online payment (Razorpay) | High |
| Receipt Download | Download fee receipts | High |
| Payment History | Past transactions | High |
| Fee Structure | View fee breakdown | Medium |

### Communication
| Feature | Description | Priority |
|---------|-------------|----------|
| Notifications | Push + in-app notifications | High |
| Announcements | School announcements | High |
| Messages | Chat with teachers | Medium |
| Circulars | Download circulars/PDFs | Medium |

### Transport
| Feature | Description | Priority |
|---------|-------------|----------|
| Bus Route | Route details, stops | High |
| Live Tracking | Real-time bus location | Medium |
| ETA Alerts | Bus arriving notifications | Medium |
| Driver Contact | Emergency contact | High |

### Other Features
| Feature | Description | Priority |
|---------|-------------|----------|
| Profile View | Student details | High |
| Leave Application | Apply for leave | High |
| PTM Booking | Book meeting slots | High |
| Concern/Feedback | Submit concerns | Medium |
| Gallery | School photos/events | Low |
| ID Card | Digital ID card | Medium |

### Screens List

```
/auth
  /login (phone OTP)
  /verify-otp
  /select-child (if multiple)

/home
  /dashboard
  /notifications
  /profile

/attendance
  /today
  /calendar
  /history

/academics
  /timetable
  /diary
  /exams
  /results
  /syllabus

/finance
  /summary
  /pay
  /receipts
  /history

/transport
  /route
  /track

/more
  /leave
  /ptm
  /feedback
  /gallery
  /id-card
  /settings
  /logout
```

---

## 2. Teacher App

### Authentication
| Feature | Description | Priority |
|---------|-------------|----------|
| Email/Password | Staff login | High |
| 2FA Support | Optional TOTP | Medium |
| Biometric | Face ID / Fingerprint | Medium |

### Dashboard
| Feature | Description | Priority |
|---------|-------------|----------|
| Today's Classes | Class schedule for today | High |
| Attendance Status | Classes with pending attendance | High |
| Quick Actions | Mark attendance, diary, leave | High |
| Announcements | Staff announcements | Medium |

### Attendance
| Feature | Description | Priority |
|---------|-------------|----------|
| Mark Attendance | Class/section selection | High |
| Bulk Mark | Mark all present/absent | High |
| View Attendance | Past attendance records | Medium |
| Attendance Report | Class-wise summary | Medium |

### Diary/Homework
| Feature | Description | Priority |
|---------|-------------|----------|
| Create Diary | Add homework for class | High |
| View Diary | Past entries | Medium |
| Subject Selection | Map to subject/period | High |
| Attachments | Add photos/files | Medium |

### My Classes
| Feature | Description | Priority |
|---------|-------------|----------|
| Timetable | My teaching schedule | High |
| Class List | Students in my classes | High |
| Student Profiles | View student details | Medium |

### Communication
| Feature | Description | Priority |
|---------|-------------|----------|
| Announcements | Create class announcements | Medium |
| Parent Messages | Reply to parent queries | Medium |
| Notifications | Receive school notices | High |

### Leave Management
| Feature | Description | Priority |
|---------|-------------|----------|
| Apply Leave | Submit leave request | High |
| Leave Balance | View remaining leaves | High |
| Leave History | Past applications | Medium |

### My Attendance
| Feature | Description | Priority |
|---------|-------------|----------|
| Check In/Out | Mark own attendance | Medium |
| My Attendance | View attendance history | Medium |

### Screens List

```
/auth
  /login
  /2fa

/home
  /dashboard
  /notifications

/attendance
  /mark
  /history
  /reports

/diary
  /create
  /list

/classes
  /timetable
  /students

/leave
  /apply
  /balance
  /history

/my-attendance
  /checkin
  /history

/profile
  /view
  /settings
```

---

## 3. Technical Architecture

### API Integration

```typescript
// apps/mobile/src/api/client.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const branchId = await SecureStore.getItemAsync('selectedBranchId');
  if (branchId) {
    config.headers['X-Branch-Id'] = branchId;
  }

  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          await SecureStore.setItemAsync('accessToken', data.data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api.request(error.config);
        } catch {
          // Refresh failed, logout
          await logout();
        }
      }
    }
    return Promise.reject(error);
  }
);
```

### Push Notifications

```typescript
// apps/mobile/src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token.data;
}

// Register token with backend
export async function saveDeviceToken(token: string) {
  await api.post('/users/device-token', {
    token,
    platform: Platform.OS,
    deviceId: Device.modelId,
  });
}
```

### Offline Support

```typescript
// apps/mobile/src/services/offline.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Cache critical data
export const offlineCache = {
  async cacheData(key: string, data: any) {
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  },

  async getCachedData<T>(key: string, maxAge = 3600000): Promise<T | null> {
    const cached = await AsyncStorage.getItem(`cache:${key}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > maxAge) return null;

    return data;
  },
};

// Network status hook
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return isConnected;
}
```

---

## 4. UI/UX Guidelines

### Design System

```
Colors:
- Primary: #2563EB (Blue)
- Secondary: #10B981 (Green)
- Accent: #F59E0B (Amber)
- Error: #EF4444 (Red)
- Background: #F9FAFB
- Surface: #FFFFFF
- Text Primary: #111827
- Text Secondary: #6B7280

Typography:
- Heading 1: 24px, Bold
- Heading 2: 20px, Semibold
- Body: 16px, Regular
- Caption: 14px, Regular
- Small: 12px, Regular

Spacing:
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
```

### Navigation Patterns

```
Bottom Tab Navigation:
- Home (Dashboard)
- Academics
- Finance
- More

Drawer Navigation (More):
- Profile
- Attendance
- Transport
- Leave
- PTM
- Feedback
- Gallery
- Settings
- Logout
```

### Loading States

```typescript
// Skeleton loading for lists
<SkeletonContent isLoading={isLoading}>
  <View style={styles.card}>
    <Skeleton.Item width="60%" height={20} />
    <Skeleton.Item width="40%" height={16} marginTop={8} />
  </View>
</SkeletonContent>

// Pull to refresh
<FlatList
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
/>
```

---

## 5. App Store Requirements

### iOS (App Store)
- Minimum iOS version: 14.0
- Required permissions:
  - Push notifications
  - Camera (for document upload)
  - Photo library
  - Location (for transport tracking)
- Privacy policy URL required
- App review process: 1-3 days

### Android (Play Store)
- Minimum Android version: API 24 (Android 7.0)
- Required permissions:
  - INTERNET
  - CAMERA
  - READ_EXTERNAL_STORAGE
  - ACCESS_FINE_LOCATION
  - RECEIVE_BOOT_COMPLETED (for notifications)
- Privacy policy URL required
- App review process: 1-7 days

### App Metadata

```
App Name: Campus Verse - School ERP
Short Description: Complete school management for parents, students & teachers

Keywords:
- School app
- Parent app
- Student attendance
- Fee payment
- School ERP
- Education app
- Homework diary
- School management

Categories:
- iOS: Education
- Android: Education
```

---

## 6. Development Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (Expo, navigation, state)
- [ ] Authentication flow
- [ ] API integration layer
- [ ] Push notification setup

### Phase 2: Student/Parent MVP (Week 3-4)
- [ ] Dashboard
- [ ] Attendance view
- [ ] Fee summary + payment
- [ ] Notifications

### Phase 3: Complete Student/Parent (Week 5-6)
- [ ] Timetable
- [ ] Diary/Homework
- [ ] Results
- [ ] Leave application
- [ ] Transport tracking

### Phase 4: Teacher App (Week 7-8)
- [ ] Teacher authentication
- [ ] Mark attendance
- [ ] Create diary
- [ ] View classes

### Phase 5: Polish & Release (Week 9-10)
- [ ] Offline support
- [ ] Performance optimization
- [ ] Testing (iOS + Android)
- [ ] App store submission

---

## 7. Testing Strategy

### Unit Tests
```typescript
// Jest + React Native Testing Library
import { render, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('should show error for invalid phone', () => {
    const { getByPlaceholder, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholder('Phone Number'), '123');
    fireEvent.press(getByText('Send OTP'));

    expect(getByText('Invalid phone number')).toBeTruthy();
  });
});
```

### E2E Tests
```typescript
// Detox for E2E testing
describe('Login Flow', () => {
  it('should login with OTP', async () => {
    await element(by.id('phone-input')).typeText('9876543210');
    await element(by.id('send-otp-button')).tap();

    await waitFor(element(by.id('otp-input'))).toBeVisible();
    await element(by.id('otp-input')).typeText('123456');
    await element(by.id('verify-button')).tap();

    await waitFor(element(by.id('dashboard'))).toBeVisible();
  });
});
```

---

## 8. Analytics & Tracking

### Events to Track

```typescript
// Analytics events
const analytics = {
  // Auth events
  'login_started': { method: 'phone' | 'email' },
  'login_success': { method: string, userId: string },
  'login_failed': { method: string, error: string },

  // Feature usage
  'attendance_viewed': { period: 'today' | 'month' },
  'fee_payment_initiated': { amount: number },
  'fee_payment_completed': { amount: number, method: string },
  'fee_payment_failed': { amount: number, error: string },

  // Engagement
  'notification_opened': { type: string },
  'diary_viewed': { date: string },
  'leave_applied': { days: number },
};
```

### Tools
- **Firebase Analytics** - Event tracking
- **Crashlytics** - Crash reporting
- **Performance Monitoring** - App performance

---

## 9. Security Considerations

### Data Storage
```typescript
// Secure storage for sensitive data
import * as SecureStore from 'expo-secure-store';

// Store tokens securely
await SecureStore.setItemAsync('accessToken', token);
await SecureStore.setItemAsync('refreshToken', refreshToken);

// Never store in AsyncStorage:
// - Tokens
// - User credentials
// - Sensitive student data
```

### Certificate Pinning
```typescript
// For production, implement certificate pinning
// to prevent MITM attacks
```

### Biometric Authentication
```typescript
import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateWithBiometrics(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to continue',
    fallbackLabel: 'Use passcode',
  });

  return result.success;
}
```

---

## 10. Release Checklist

### Pre-release
- [ ] All critical features working
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured
- [ ] Performance tested (no memory leaks)
- [ ] Offline mode tested
- [ ] Deep links working
- [ ] Push notifications tested
- [ ] All permissions explained

### App Store Submission
- [ ] Screenshots (all device sizes)
- [ ] App icon (1024x1024)
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Marketing description
- [ ] Keywords optimized
- [ ] Age rating set
- [ ] Contact information

### Post-release
- [ ] Monitor crash reports
- [ ] Monitor reviews
- [ ] Monitor analytics
- [ ] Plan version 1.1 fixes
