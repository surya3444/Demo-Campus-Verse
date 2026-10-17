import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import { useBiometrics, getBiometricLabel } from '@campus-verse/mobile-shared/hooks/useBiometrics';

function ProfileHeader() {
  const user = useAuthStore((state) => state.user);

  return (
    <View
      style={{
        backgroundColor: '#1e1b4b',
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 36,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Cyan blur orb backdrop */}
      <View
        style={{
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: 'rgba(6,182,212,0.18)',
          top: -90,
          right: -70,
          opacity: 0.7,
        }}
      />
      <Text
        style={{
          fontFamily: 'SpaceMono',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 10,
          letterSpacing: 3,
          marginBottom: 16,
        }}
      >
        TEACHER PROFILE
      </Text>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>
          {user?.firstName?.[0]}
          {user?.lastName?.[0]}
        </Text>
        <View
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#06b6d4',
            borderWidth: 3,
            borderColor: '#1e1b4b',
          }}
        />
      </View>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
        {user?.displayName}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 13 }}>
        {user?.email}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(6,182,212,0.15)',
          paddingHorizontal: 11,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(6,182,212,0.4)',
          marginTop: 12,
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#06b6d4' }} />
        <Text
          style={{
            fontFamily: 'SpaceMono',
            color: '#06b6d4',
            fontSize: 10,
            letterSpacing: 1.4,
            marginLeft: 6,
            fontWeight: '700',
          }}
        >
          {(user?.roleName || 'STAFF').toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}

function MenuItem({ icon, label, value, onPress, rightElement, destructive }: MenuItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100"
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: destructive ? '#fef2f2' : '#f8fafc' }}
      >
        <Ionicons name={icon} size={20} color={destructive ? '#ef4444' : '#6b7280'} />
      </View>
      <View className="flex-1">
        <Text className={`font-medium ${destructive ? 'text-red-500' : 'text-gray-900'}`}>
          {label}
        </Text>
        {value && <Text className="text-gray-500 text-sm mt-0.5">{value}</Text>}
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={20} color="#9ca3af" />)}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-gray-500 text-xs font-medium uppercase px-5 pt-6 pb-2">{title}</Text>
  );
}

export default function TeacherProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const selectedBranchId = useAuthStore((state) => state.selectedBranchId);
  const logout = useAuthStore((state) => state.logout);

  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    biometricType,
    enableBiometrics,
    disableBiometrics,
  } = useBiometrics();

  const [biometricLoading, setBiometricLoading] = useState(false);

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricLoading(true);
    try {
      if (value) {
        await enableBiometrics();
      } else {
        await disableBiometrics();
      }
    } catch {
      Alert.alert('Error', 'Failed to update biometric settings');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    router.push('/(auth)/change-password' as never);
  };

  const handleContactSupport = () => {
    router.push('/support/feedback' as never);
  };

  const currentBranch = user?.branches?.find((b) => b.branchId === selectedBranchId);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <ProfileHeader />

      {/* Account Info */}
      <View
        className="bg-white mx-5 -mt-6 rounded-xl shadow-sm overflow-hidden"
        style={{ elevation: 3 }}
      >
        <MenuItem icon="mail-outline" label="Email" value={user?.email} />
        <MenuItem icon="call-outline" label="Phone" value={user?.phone || 'Not set'} />
        <MenuItem
          icon="business-outline"
          label="Branch"
          value={currentBranch?.branchName || 'Not selected'}
        />
      </View>

      {/* Security */}
      <SectionHeader title="Security" />
      <View className="bg-white overflow-hidden">
        <MenuItem
          icon="lock-closed-outline"
          label="Change Password"
          onPress={handleChangePassword}
        />
        {biometricAvailable && (
          <MenuItem
            icon={biometricType === 'facial' ? 'scan-outline' : 'finger-print-outline'}
            label={`${getBiometricLabel(biometricType)} Login`}
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={biometricLoading}
                trackColor={{ false: '#e5e7eb', true: '#a5b4fc' }}
                thumbColor={biometricEnabled ? '#4f46e5' : '#f4f4f5'}
              />
            }
          />
        )}
      </View>

      {/* Preferences */}
      <SectionHeader title="Preferences" />
      <View className="bg-white overflow-hidden">
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          value="Enabled"
          onPress={() => {}}
        />
        <MenuItem icon="moon-outline" label="Dark Mode" value="System" onPress={() => {}} />
        <MenuItem icon="language-outline" label="Language" value="English" onPress={() => {}} />
      </View>

      {/* Support */}
      <SectionHeader title="Support" />
      <View className="bg-white overflow-hidden">
        <MenuItem
          icon="chatbubble-outline"
          label="Support & Concerns"
          onPress={handleContactSupport}
        />
      </View>

      {/* Logout */}
      <View className="mt-6 mb-8">
        <MenuItem icon="log-out-outline" label="Logout" onPress={handleLogout} destructive />
      </View>

      {/* App Version */}
      <View className="items-center pb-8">
        <Text className="text-gray-400 text-sm">CampusVerse Staff v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
