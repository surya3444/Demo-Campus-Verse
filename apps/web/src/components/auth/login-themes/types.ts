import { UseFormRegister, FieldErrors } from 'react-hook-form';

export type LoginThemeId = 'premium' | 'brutalist' | 'glass' | 'retro' | 'minimal';

export interface LoginTheme {
  id: LoginThemeId;
  name: string;
  description: string;
  preview: string; // emoji or short visual indicator
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginFormProps {
  register: UseFormRegister<LoginFormData>;
  errors: FieldErrors<LoginFormData>;
  isLoading: boolean;
  error: string | null;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LOGIN_THEMES: LoginTheme[] = [
  {
    id: 'premium',
    name: 'Premium',
    description: 'Elegant gradients with animated orbs',
    preview: '🌊',
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    description: 'Raw, industrial, bold typography',
    preview: '🏗️',
  },
  {
    id: 'glass',
    name: 'Aurora',
    description: 'Ethereal glassmorphism with flowing colors',
    preview: '✨',
  },
  {
    id: 'retro',
    name: 'Academic',
    description: 'Classic vintage university aesthetic',
    preview: '📜',
  },
  {
    id: 'minimal',
    name: 'Zen',
    description: 'Extreme simplicity, pure focus',
    preview: '🪷',
  },
];
