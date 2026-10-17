import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import type { Child } from '@campus-verse/mobile-shared/store/authStore';

function ChildCard({
  child,
  isSelected,
  onSelect,
}: {
  child: Child;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-row items-center p-4 mx-4 mb-3 rounded-xl border-2 ${
        isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
      }`}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View
        className={`w-14 h-14 rounded-full items-center justify-center mr-4 ${
          isSelected ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <Text className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
          {child.studentName?.charAt(0) || 'S'}
        </Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text className={`font-semibold text-lg ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
          {child.studentName}
        </Text>
        <Text className="text-gray-500 text-sm mt-0.5">
          {child.className} - {child.sectionName}
        </Text>
        {child.rollNumber && (
          <Text className="text-gray-400 text-xs mt-0.5">Roll No: {child.rollNumber}</Text>
        )}
      </View>

      {/* Check Icon */}
      {isSelected && (
        <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
          <Ionicons name="checkmark" size={20} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ChildSelectorScreen() {
  const router = useRouter();
  const children = useAuthStore((state) => state.children);
  const selectedChild = useAuthStore((state) => state.selectedChild);
  const selectChild = useAuthStore((state) => state.selectChild);

  const handleSelect = (child: Child) => {
    selectChild(child);
    router.back();
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header Info */}
      <View className="bg-white px-5 py-4 border-b border-gray-100">
        <Text className="text-gray-500 text-sm">Select a child to view their information</Text>
      </View>

      {/* Children List */}
      <FlatList
        data={children}
        keyExtractor={(item) => item.studentId}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <ChildCard
            child={item}
            isSelected={selectedChild?.studentId === item.studentId}
            onSelect={() => handleSelect(item)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="people-outline" size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-3">No children found</Text>
          </View>
        }
      />
    </View>
  );
}
