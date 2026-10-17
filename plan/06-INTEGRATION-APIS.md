# Third-Party Integration APIs

This document outlines all third-party integrations required for Campus Verse.

---

## 1. Payment Gateway (Razorpay)

### Overview

- **Provider**: Razorpay
- **Use Case**: Online fee payment, application fees
- **Status**: Partially implemented

### Integration Points

#### Create Order

```typescript
// apps/api/src/services/razorpay.service.ts
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function createOrder(params: {
  amount: number; // in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const order = await razorpay.orders.create({
    amount: params.amount,
    currency: params.currency || 'INR',
    receipt: params.receipt,
    notes: params.notes,
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.RAZORPAY_KEY_ID,
  };
}
```

#### Verify Payment

```typescript
import crypto from 'crypto';

export function verifyPayment(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const body = params.razorpay_order_id + '|' + params.razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');

  return expectedSignature === params.razorpay_signature;
}
```

#### Webhook Handler

```typescript
// POST /webhooks/razorpay
export async function handleRazorpayWebhook(req: Request, res: Response) {
  const signature = req.headers['x-razorpay-signature'] as string;
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  switch (event.event) {
    case 'payment.captured':
      await handlePaymentCaptured(event.payload.payment.entity);
      break;
    case 'payment.failed':
      await handlePaymentFailed(event.payload.payment.entity);
      break;
    case 'refund.created':
      await handleRefundCreated(event.payload.refund.entity);
      break;
  }

  res.json({ status: 'ok' });
}
```

### Environment Variables

```env
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
```

**Priority**: P0 (Critical)
**Effort**: 1 week (completion)

---

## 2. SMS Gateway (MSG91)

### Overview

- **Provider**: MSG91 (DLT compliant)
- **Use Case**: OTP, notifications, alerts
- **Status**: Framework exists, needs completion

### DLT Registration

```
Steps:
1. Register on DLT portal (e.g., Jio/Airtel/Vodafone)
2. Register sender ID (e.g., CAMPUS)
3. Register message templates
4. Get template IDs
5. Configure in MSG91
```

### Integration

```typescript
// apps/api/src/services/sms.service.ts
import axios from 'axios';

const MSG91_API = 'https://control.msg91.com/api/v5';

export async function sendSMS(params: {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
}) {
  const response = await axios.post(
    `${MSG91_API}/flow`,
    {
      template_id: params.templateId,
      short_url: '0',
      recipients: [
        {
          mobiles: `91${params.phone}`,
          ...params.variables,
        },
      ],
    },
    {
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

export async function sendOTP(phone: string) {
  const response = await axios.post(
    `${MSG91_API}/otp`,
    {
      template_id: process.env.MSG91_OTP_TEMPLATE_ID,
      mobile: `91${phone}`,
      otp_length: 6,
      otp_expiry: 10, // minutes
    },
    {
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
      },
    }
  );

  return response.data;
}

export async function verifyOTP(phone: string, otp: string) {
  const response = await axios.get(`${MSG91_API}/otp/verify?otp=${otp}&mobile=91${phone}`, {
    headers: {
      authkey: process.env.MSG91_AUTH_KEY,
    },
  });

  return response.data.type === 'success';
}
```

### DLT Templates

| Template Purpose | Sample                                                                                     | Variables                |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| Fee Reminder     | Dear {#var#}, fees of Rs.{#var#} for {#var#} is due on {#var#}. Pay now to avoid late fee. | name, amount, term, date |
| Attendance Alert | Dear Parent, your ward {#var#} was marked absent today ({#var#}).                          | name, date               |
| Result           | Dear {#var#}, results for {#var#} are now available. Check the app.                        | name, exam               |
| OTP              | {#var#} is your OTP for Campus Verse. Valid for 10 minutes.                                | otp                      |

### Environment Variables

```env
MSG91_AUTH_KEY=xxx
MSG91_SENDER_ID=CAMPUS
MSG91_OTP_TEMPLATE_ID=xxx
MSG91_FEE_REMINDER_TEMPLATE_ID=xxx
MSG91_ATTENDANCE_TEMPLATE_ID=xxx
```

**Priority**: P0 (Critical)
**Effort**: 1 week

---

## 3. Email Service (Resend) - ALREADY IMPLEMENTED

### Overview

- **Provider**: Resend
- **Use Case**: Password reset, notifications, reports
- **Status**: FULLY IMPLEMENTED

### Current Implementation

Email service already exists at `apps/api/src/services/email.service.ts` with:

- `sendVerificationEmail()` - Email verification for signups
- `sendApprovalEmail()` - Organization approval notifications
- `sendRejectionEmail()` - Organization rejection with reason
- `sendUserWelcomeEmail()` - Welcome email with temp password
- `sendPasswordResetEmail()` - Password reset notifications
- `notifySuperAdminNewSignup()` - Admin notifications

### Environment Variables (Already configured)

```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Campus Verse <campusverse@chiranjeeb.dev>
SUPER_ADMIN_EMAIL=campusverse@chiranjeeb.dev
```

### Future Enhancements (Optional)

- Bulk email campaigns
- Email with attachments (reports, receipts)
- HTML template editor

### Example Email Template (Already exists)

name: string;
resetLink: string;
}) => `

<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .button { background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>
    <p>Hi ${params.name},</p>
    <p>We received a request to reset your password. Click the button below to proceed:</p>
    <p><a href="${params.resetLink}" class="button">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>
`;
```

### Environment Variables

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=REPLACE_WITH_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_SECRET_KEY
EMAIL_FROM=Campus Verse <noreply@campusverse.app>
EMAIL_REPLY_TO=support@campusverse.app
```

**Priority**: P0 (Critical)
**Effort**: 1 week

---

## 4. WhatsApp Business API

### Overview

- **Provider**: 360dialog / Gupshup / Meta Direct
- **Use Case**: Notifications, reminders, support
- **Status**: Not implemented

### Integration (via 360dialog)

```typescript
// apps/api/src/services/whatsapp.service.ts
import axios from 'axios';

const WHATSAPP_API = 'https://waba.360dialog.io/v1';

export async function sendWhatsAppTemplate(params: {
  phone: string;
  templateName: string;
  language: string;
  components: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: 'text'; text: string }>;
  }>;
}) {
  const response = await axios.post(
    `${WHATSAPP_API}/messages`,
    {
      messaging_product: 'whatsapp',
      to: `91${params.phone}`,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.language || 'en' },
        components: params.components,
      },
    },
    {
      headers: {
        'D360-API-KEY': process.env.WHATSAPP_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

// Example: Send fee reminder
export async function sendFeeReminderWhatsApp(params: {
  phone: string;
  studentName: string;
  amount: number;
  dueDate: string;
}) {
  return sendWhatsAppTemplate({
    phone: params.phone,
    templateName: 'fee_reminder',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.studentName },
          { type: 'text', text: params.amount.toString() },
          { type: 'text', text: params.dueDate },
        ],
      },
    ],
  });
}
```

### Template Approval

WhatsApp templates need approval before use. Plan templates in advance:

| Template         | Purpose              | Variables                      |
| ---------------- | -------------------- | ------------------------------ |
| fee_reminder     | Fee due reminder     | student_name, amount, due_date |
| attendance_alert | Absence notification | student_name, date             |
| result_published | Result announcement  | student_name, exam_name        |
| ptm_reminder     | PTM reminder         | date, time, teacher_name       |

**Priority**: P2 (Medium)
**Effort**: 2 weeks

---

## 5. Push Notifications (FCM)

### Overview

- **Provider**: Firebase Cloud Messaging
- **Use Case**: Mobile app notifications
- **Status**: Not implemented

### Integration

```typescript
// apps/api/src/services/push.service.ts
import admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

export async function sendPushNotification(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}) {
  const message = {
    token: params.token,
    notification: {
      title: params.title,
      body: params.body,
      imageUrl: params.imageUrl,
    },
    data: params.data || {},
    android: {
      priority: 'high' as const,
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  return admin.messaging().send(message);
}

export async function sendMultiplePush(params: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const message = {
    tokens: params.tokens,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: params.data || {},
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Handle failed tokens (remove from database)
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
      // Remove invalid token
      removeDeviceToken(params.tokens[idx]);
    }
  });

  return response;
}

// Topic-based notifications
export async function sendToTopic(params: {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const message = {
    topic: params.topic,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: params.data || {},
  };

  return admin.messaging().send(message);
}
```

### Topic Structure

```
Topics:
- branch_{branchId}_all
- branch_{branchId}_parents
- branch_{branchId}_teachers
- branch_{branchId}_class_{classId}
- branch_{branchId}_section_{sectionId}
```

**Priority**: P1 (High)
**Effort**: 1 week

---

## 6. Biometric Device Integration

### Overview

- **Devices**: ZKTeco, eSSL, BioMax
- **Use Case**: Staff/student attendance
- **Status**: Not implemented

### ZKTeco Integration (Push Mode)

```typescript
// ZKTeco devices can push data to a webhook
// POST /webhooks/biometric

interface BiometricEvent {
  device_id: string;
  user_id: string;
  timestamp: string;
  verify_mode: number; // 1=fingerprint, 2=card, 3=password, 4=face
  event_type: 'check_in' | 'check_out';
}

export async function handleBiometricWebhook(req: Request, res: Response) {
  const event: BiometricEvent = req.body;

  // Map device user_id to staff/student
  const user = await findUserByBiometricId(event.device_id, event.user_id);

  if (!user) {
    console.warn(`Unknown biometric user: ${event.user_id}`);
    return res.json({ status: 'unknown_user' });
  }

  // Record attendance
  if (user.type === 'staff') {
    await recordStaffAttendance({
      staffId: user.id,
      timestamp: new Date(event.timestamp),
      type: event.event_type,
      source: 'biometric',
      deviceId: event.device_id,
    });
  } else if (user.type === 'student') {
    await recordStudentAttendance({
      studentId: user.id,
      timestamp: new Date(event.timestamp),
      status: 'present',
      source: 'biometric',
    });
  }

  res.json({ status: 'ok' });
}
```

### ZKTeco Pull Mode (SDK)

```typescript
// For devices that don't support push
import { ZKLib } from 'zklib-js';

async function syncAttendanceFromDevice(deviceConfig: { ip: string; port: number }) {
  const zk = new ZKLib(deviceConfig.ip, deviceConfig.port);

  try {
    await zk.connect();

    // Get attendance logs
    const logs = await zk.getAttendance();

    for (const log of logs) {
      await processAttendanceLog(log);
    }

    // Clear logs from device after sync
    await zk.clearAttendance();
  } finally {
    await zk.disconnect();
  }
}
```

**Priority**: P2 (Medium)
**Effort**: 3 weeks

---

## 7. GPS Tracking (Transport)

### Overview

- **Provider**: Google Maps API / HERE Maps
- **Device**: GPS trackers (Teltonika, etc.)
- **Use Case**: Bus tracking
- **Status**: Not implemented

### GPS Device Integration

```typescript
// GPS devices typically send data via TCP/HTTP
// Server to receive GPS data

import net from 'net';

const gpsServer = net.createServer((socket) => {
  socket.on('data', async (data) => {
    const parsed = parseGPSData(data); // Protocol-specific parsing

    await updateVehicleLocation({
      vehicleId: parsed.deviceId,
      latitude: parsed.lat,
      longitude: parsed.lng,
      speed: parsed.speed,
      timestamp: parsed.timestamp,
    });

    // Check geofencing
    await checkGeofence(parsed);
  });
});

gpsServer.listen(5000, () => {
  console.log('GPS server listening on port 5000');
});
```

### Real-time Location API

```typescript
// WebSocket for real-time updates
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// Subscribe to vehicle updates
wss.on('connection', (ws, req) => {
  const vehicleId = req.url?.split('/').pop();

  // Subscribe to Redis pub/sub for this vehicle
  const subscriber = redis.duplicate();
  subscriber.subscribe(`vehicle:${vehicleId}:location`);

  subscriber.on('message', (channel, message) => {
    ws.send(message);
  });

  ws.on('close', () => {
    subscriber.unsubscribe();
    subscriber.quit();
  });
});

// Publish location updates
export async function publishVehicleLocation(vehicleId: string, location: VehicleLocation) {
  await redis.publish(`vehicle:${vehicleId}:location`, JSON.stringify(location));
}
```

### Google Maps Integration

```typescript
// Distance and ETA calculation
import { Client } from '@googlemaps/google-maps-services-js';

const mapsClient = new Client({});

export async function getRouteETA(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: Array<{ lat: number; lng: number }>;
}) {
  const response = await mapsClient.directions({
    params: {
      key: process.env.GOOGLE_MAPS_API_KEY!,
      origin: params.origin,
      destination: params.destination,
      waypoints: params.waypoints?.map((w) => `${w.lat},${w.lng}`),
      mode: 'driving',
      departure_time: 'now',
    },
  });

  return {
    distance: response.data.routes[0].legs[0].distance,
    duration: response.data.routes[0].legs[0].duration,
    durationInTraffic: response.data.routes[0].legs[0].duration_in_traffic,
  };
}
```

**Priority**: P2 (Medium)
**Effort**: 4 weeks

---

## 8. Video Conferencing (Online Classes)

### Overview

- **Provider**: Zoom / Google Meet / Jitsi
- **Use Case**: Online classes
- **Status**: Not implemented

### Zoom Integration

```typescript
// apps/api/src/services/zoom.service.ts
import axios from 'axios';

const ZOOM_API = 'https://api.zoom.us/v2';

// Get access token (Server-to-Server OAuth)
async function getZoomToken(): Promise<string> {
  const response = await axios.post(
    'https://zoom.us/oauth/token',
    new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: process.env.ZOOM_ACCOUNT_ID!,
    }),
    {
      auth: {
        username: process.env.ZOOM_CLIENT_ID!,
        password: process.env.ZOOM_CLIENT_SECRET!,
      },
    }
  );

  return response.data.access_token;
}

export async function createMeeting(params: {
  topic: string;
  startTime: Date;
  duration: number; // minutes
  hostEmail: string;
}) {
  const token = await getZoomToken();

  const response = await axios.post(
    `${ZOOM_API}/users/${params.hostEmail}/meetings`,
    {
      topic: params.topic,
      type: 2, // Scheduled meeting
      start_time: params.startTime.toISOString(),
      duration: params.duration,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return {
    meetingId: response.data.id,
    joinUrl: response.data.join_url,
    startUrl: response.data.start_url,
    password: response.data.password,
  };
}

export async function getMeetingParticipants(meetingId: string) {
  const token = await getZoomToken();

  const response = await axios.get(`${ZOOM_API}/past_meetings/${meetingId}/participants`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data.participants;
}
```

**Priority**: P3 (Low)
**Effort**: 2 weeks

---

## 9. Accounting Integration (Tally)

### Overview

- **Provider**: Tally ERP 9 / Tally Prime
- **Use Case**: Export financial data
- **Status**: Not implemented

### Tally XML Export

```typescript
// Generate Tally-compatible XML
export function generateTallyVoucher(transaction: FeeTransaction): string {
  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${formatTallyDate(transaction.date)}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${transaction.receiptNumber}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${transaction.studentName}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${transaction.amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Fees Received</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${transaction.amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
```

**Priority**: P3 (Low)
**Effort**: 2 weeks

---

## 10. DigiLocker Integration

### Overview

- **Provider**: Government of India
- **Use Case**: Document verification, digital certificates
- **Status**: Not implemented

### Integration (Partner API)

```
Steps:
1. Register as DigiLocker partner
2. Get API credentials
3. Implement OAuth flow
4. Push/pull documents

Use Cases:
- Push certificates to student's DigiLocker
- Verify Aadhaar
- Verify education documents
```

**Priority**: P3 (Low)
**Effort**: 4 weeks

---

## Integration Summary

| Integration        | Provider           | Priority | Status      | Effort  |
| ------------------ | ------------------ | -------- | ----------- | ------- |
| Payment Gateway    | Razorpay           | P0       | Partial     | 1 week  |
| SMS                | MSG91              | P0       | Partial     | 1 week  |
| Email              | Resend             | P0       | **DONE**    | -       |
| File Storage       | AWS S3             | P0       | Not started | 3 days  |
| Push Notifications | FCM                | P1       | Not started | 1 week  |
| WhatsApp           | 360dialog          | P2       | Not started | 2 weeks |
| Biometric          | ZKTeco             | P2       | Not started | 3 weeks |
| GPS Tracking       | Teltonika + Google | P2       | Not started | 4 weeks |
| Video Conferencing | Zoom               | P3       | Not started | 2 weeks |
| Accounting         | Tally              | P3       | Not started | 2 weeks |
| DigiLocker         | Govt               | P3       | Not started | 4 weeks |

---

## Environment Variables (All Integrations)

```env
# Razorpay
RAZORPAY_KEY_ID=xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# MSG91
MSG91_AUTH_KEY=xxx
MSG91_SENDER_ID=CAMPUS
MSG91_OTP_TEMPLATE_ID=xxx

# AWS S3 (Configured)
AWS_ACCESS_KEY_ID=REPLACE_WITH_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_SECRET_KEY
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=qr-code-logo

# Email - Resend (Already configured)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Campus Verse <campusverse@chiranjeeb.dev>
SUPER_ADMIN_EMAIL=campusverse@chiranjeeb.dev

# Firebase (for Push Notifications)
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_CLIENT_EMAIL=xxx

# WhatsApp
WHATSAPP_API_KEY=xxx

# Google Maps
GOOGLE_MAPS_API_KEY=xxx

# Zoom
ZOOM_ACCOUNT_ID=xxx
ZOOM_CLIENT_ID=xxx
ZOOM_CLIENT_SECRET=xxx
```
