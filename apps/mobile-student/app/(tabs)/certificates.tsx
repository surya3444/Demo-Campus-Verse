import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentStudentId } from '@campus-verse/mobile-shared/hooks/useAuth';
import { certificatesApi, CertificateType, CertificateRequest } from '@/api/certificates';

const STATUS_MAP: Record<string, { color: string; bg: string; icon: string }> = {
  pending: { color: '#f59e0b', bg: '#fef3c7', icon: 'time-outline' },
  approved: { color: '#3b82f6', bg: '#eff6ff', icon: 'checkmark-circle-outline' },
  rejected: { color: '#ef4444', bg: '#fef2f2', icon: 'close-circle-outline' },
  issued: { color: '#10b981', bg: '#f0fdf4', icon: 'ribbon-outline' },
  cancelled: { color: '#94a3b8', bg: '#f1f5f9', icon: 'ban-outline' },
};

export default function CertificatesScreen() {
  const insets = useSafeAreaInsets();
  const studentId = useCurrentStudentId();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<CertificateType | null>(null);
  const [purpose, setPurpose] = useState('');

  const {
    data: requests,
    refetch: refetchRequests,
    isLoading: loadingRequests,
  } = useQuery({
    queryKey: ['certificate-requests', studentId],
    queryFn: () => certificatesApi.getMyRequests(studentId!),
    enabled: !!studentId,
  });

  const { data: types } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: () => certificatesApi.getTypes(),
  });

  const studentTypes = (types || []).filter(
    (t) => t.category === 'student' && t.status === 'active'
  );

  const createMutation = useMutation({
    mutationFn: (data: { certificateTypeId: string; purpose?: string }) =>
      certificatesApi.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificate-requests'] });
      setShowModal(false);
      setSelectedType(null);
      setPurpose('');
      Alert.alert('Success', 'Certificate request submitted successfully');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchRequests();
    setRefreshing(false);
  }, [refetchRequests]);

  const handleSubmitRequest = () => {
    if (!selectedType) return;
    createMutation.mutate({
      certificateTypeId: selectedType._id,
      purpose: purpose.trim() || undefined,
    });
  };

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
        <View
          style={{
            paddingTop: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View>
            <Text
              style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 }}
            >
              Certificates
            </Text>
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Request & Track</Text>
          </View>
          {studentTypes.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#3b82f6',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                Request
              </Text>
            </TouchableOpacity>
          )}
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
        {loadingRequests ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : !requests || requests.length === 0 ? (
          <EmptyState onRequest={studentTypes.length > 0 ? () => setShowModal(true) : undefined} />
        ) : (
          requests.map((req) => <RequestCard key={req._id} request={req} />)
        )}
      </ScrollView>

      {/* Request Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
                Request Certificate
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowModal(false);
                  setSelectedType(null);
                  setPurpose('');
                }}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400, padding: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 10 }}>
                SELECT TYPE
              </Text>
              {studentTypes.map((type) => (
                <TouchableOpacity
                  key={type._id}
                  onPress={() => setSelectedType(type)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 8,
                    backgroundColor: selectedType?._id === type._id ? '#eff6ff' : '#f8fafc',
                    borderWidth: 1.5,
                    borderColor: selectedType?._id === type._id ? '#3b82f6' : '#f1f5f9',
                  }}
                >
                  <Ionicons
                    name="ribbon-outline"
                    size={20}
                    color={selectedType?._id === type._id ? '#3b82f6' : '#94a3b8'}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#0f172a',
                      marginLeft: 10,
                      flex: 1,
                    }}
                  >
                    {type.name}
                  </Text>
                  {selectedType?._id === type._id && (
                    <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}

              {selectedType && (
                <View style={{ marginTop: 16 }}>
                  <Text
                    style={{ fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8 }}
                  >
                    PURPOSE (OPTIONAL)
                  </Text>
                  <TextInput
                    value={purpose}
                    onChangeText={setPurpose}
                    placeholder="Enter the purpose for this certificate..."
                    multiline
                    numberOfLines={3}
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 14,
                      color: '#0f172a',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      minHeight: 80,
                      textAlignVertical: 'top',
                    }}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              )}
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <TouchableOpacity
                onPress={handleSubmitRequest}
                disabled={!selectedType || createMutation.isPending}
                activeOpacity={0.7}
                style={{
                  backgroundColor: selectedType ? '#3b82f6' : '#cbd5e1',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="#ffffff" />
                    <Text
                      style={{ color: '#ffffff', fontSize: 15, fontWeight: '700', marginLeft: 8 }}
                    >
                      Submit Request
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RequestCard({ request }: { request: CertificateRequest }) {
  const s = STATUS_MAP[request.status] || STATUS_MAP.pending;

  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
      }}
    >
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 10,
          }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>
              {request.certificateTypeName || 'Certificate'}
            </Text>
            {request.certificateNumber && (
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                #{request.certificateNumber}
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 10,
              backgroundColor: s.bg,
            }}
          >
            <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={12} color={s.color} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: s.color, marginLeft: 4 }}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Text>
          </View>
        </View>

        {request.purpose && (
          <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }} numberOfLines={2}>
            {request.purpose}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
          <Text style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>
            Requested{' '}
            {new Date(request.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>

        {request.rejectionReason && (
          <View style={{ marginTop: 8, backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: '#ef4444' }}>
              Reason: {request.rejectionReason}
            </Text>
          </View>
        )}

        {request.status === 'issued' && request.issuedAt && (
          <View
            style={{
              marginTop: 8,
              backgroundColor: '#f0fdf4',
              padding: 10,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={{ fontSize: 12, color: '#10b981', marginLeft: 6, fontWeight: '600' }}>
              Issued on{' '}
              {new Date(request.issuedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState({ onRequest }: { onRequest?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#e0f2fe',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name="ribbon-outline" size={36} color="#0891b2" />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>
        No Certificates
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
        You haven't requested any certificates yet.
      </Text>
      {onRequest && (
        <TouchableOpacity
          onPress={onRequest}
          activeOpacity={0.7}
          style={{
            marginTop: 20,
            backgroundColor: '#3b82f6',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
            Request Certificate
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
