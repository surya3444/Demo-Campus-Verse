import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// S1-15 & S1-16: API error handling utility
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

// S1-16: Get user-friendly error message based on error code
export function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: ApiErrorResponse; status?: number } };

  if (axiosError.response?.data?.error) {
    const { code, message } = axiosError.response.data.error;

    // Handle specific error codes with custom messages
    switch (code) {
      case 'PERMISSION_DENIED':
        return (
          message || "You don't have permission for this action. Please contact your administrator."
        );
      case 'AUTH_UNAUTHORIZED':
        return 'Your session has expired. Please log in again.';
      case 'BRANCH_REQUIRED':
        return 'Please select a branch to continue.';
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.';
      case 'DUPLICATE_ENTRY':
        return 'A record with this value already exists.';
      case 'NOT_FOUND':
        return message || 'The requested resource was not found.';
      default:
        return message || 'An unexpected error occurred. Please try again.';
    }
  }

  // Handle network errors
  if (axiosError.response?.status === 0) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Handle HTTP status codes
  const status = axiosError.response?.status;
  if (status === 403) {
    return "You don't have permission for this action. Please contact your administrator.";
  }
  if (status === 404) {
    return 'The requested resource was not found.';
  }
  if (status === 500) {
    return 'An unexpected server error occurred. Please try again later.';
  }

  // Fallback
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// S1-16: Check if error is a permission error
export function isPermissionError(error: unknown): boolean {
  const axiosError = error as { response?: { data?: ApiErrorResponse; status?: number } };

  return (
    axiosError.response?.status === 403 ||
    axiosError.response?.data?.error?.code === 'PERMISSION_DENIED' ||
    axiosError.response?.data?.error?.code === 'AUTH_UNAUTHORIZED'
  );
}
