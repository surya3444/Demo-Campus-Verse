import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { hostelApi, BedAllocation } from '@/api/hostel';

export default function HostelScreen() {
  const insets = useSafeAreaInsets();
  const studentId = useCurrentStudentId();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: allocation,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['hostel-allocation', studentId],
    queryFn: () => hostelApi.getMyAllocation(studentId!),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#ffffff',
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        }}
      >
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 }}>
            Hostel
          </Text>
          <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>My Accommodation</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : !allocation ? (
          <EmptyState />
        ) : (
          <AllocationCard allocation={allocation} />
        )}
      </ScrollView>
    </View>
  );
}

function AllocationCard({ allocation }: { allocation: BedAllocation }) {
  return (
    <View>
      {/* Main Card */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#f1f5f9',
        }}
      >
        {/* Header Banner */}
        <View style={{ backgroundColor: '#d97706', paddingHorizontal: 20, paddingVertical: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="bed" size={20} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
                {allocation.hostelName}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                {allocation.status === 'active' ? 'Currently Allocated' : allocation.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Details Grid */}
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <InfoItem icon="home-outline" label="Room" value={allocation.roomNumber} />
            <InfoItem icon="bed-outline" label="Bed" value={allocation.bedNumber} />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <InfoItem
              icon="calendar-outline"
              label="Allocated On"
              value={formatDate(allocation.allocationDate)}
            />
            <InfoItem
              icon="time-outline"
              label="Valid Until"
              value={
                allocation.expectedVacatingDate
                  ? formatDate(allocation.expectedVacatingDate)
                  : 'Not set'
              }
            />
          </View>
          {(allocation.className || allocation.admissionNumber) && (
            <View style={{ flexDirection: 'row' }}>
              {allocation.className && (
                <InfoItem icon="school-outline" label="Class" value={allocation.className} />
              )}
              {allocation.admissionNumber && (
                <InfoItem icon="card-outline" label="Adm. No." value={allocation.admissionNumber} />
              )}
            </View>
          )}
        </View>
      </View>

      {/* Status Badge */}
      <View
        style={{
          marginTop: 16,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#f1f5f9',
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: allocation.status === 'active' ? '#22c55e' : '#94a3b8',
            marginRight: 10,
          }}
        />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 }}>
          Status: {allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
        </Text>
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={allocation.status === 'active' ? '#22c55e' : '#94a3b8'}
        />
      </View>
    </View>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color="#94a3b8" />
        <Text style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }}>{value}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#fef3c7',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name="bed-outline" size={36} color="#d97706" />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>
        No Hostel Allocation
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: '#94a3b8',
          textAlign: 'center',
          paddingHorizontal: 40,
          lineHeight: 20,
        }}
      >
        You don't have a hostel room allocated yet. Contact your administration for hostel requests.
      </Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
