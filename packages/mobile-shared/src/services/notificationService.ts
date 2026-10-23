import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushToken {
  token: string;
  type: 'expo' | 'fcm' | 'apns';
}

export const notificationService = {
  async registerForPushNotifications(): Promise<PushToken | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    // Get push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-eas-project-id', // Will be replaced with actual project ID
      });

      // Android requires notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0749BB',
        });

        // Create channel for announcements
        await Notifications.setNotificationChannelAsync('announcements', {
          name: 'Announcements',
          description: 'School announcements and notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0749BB',
        });

        // Create channel for attendance
        await Notifications.setNotificationChannelAsync('attendance', {
          name: 'Attendance',
          description: 'Attendance alerts and updates',
          importance: Notifications.AndroidImportance.HIGH,
        });

        // Create channel for fees
        await Notifications.setNotificationChannelAsync('fees', {
          name: 'Fees & Payments',
          description: 'Fee reminders and payment confirmations',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      return {
        token: tokenData.data,
        type: 'expo',
      };
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  },

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  },

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  },

  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
  },

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: trigger || null,
    });
  },

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  },
};
