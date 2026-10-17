import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@campus-verse/mobile-shared/api/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setIsSuccess(true);
    } catch {
      // Don't reveal if email exists or not for security
      setIsSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <View className="flex-1 bg-white justify-center px-6">
        <View className="items-center">
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="mail" size={40} color="#22c55e" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center">Check your email</Text>
          <Text className="text-gray-500 text-center mt-3 px-4">
            If an account exists with {email}, you will receive a password reset link shortly.
          </Text>
          <TouchableOpacity
            className="mt-8 py-4 px-8 bg-primary rounded-xl"
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-12">
          {/* Back Button */}
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-8">
            <Ionicons name="arrow-back" size={24} color="#374151" />
            <Text className="text-gray-700 ml-2 text-base">Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">Forgot Password</Text>
            <Text className="text-gray-500 mt-2">
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View>
            {/* Email Input */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
              <View
                className={`flex-row items-center border rounded-xl px-4 py-3 ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <Ionicons name="mail-outline" size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter your email"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
              {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className={`mt-6 py-4 rounded-xl items-center ${
                isLoading ? 'bg-primary/70' : 'bg-primary'
              }`}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
