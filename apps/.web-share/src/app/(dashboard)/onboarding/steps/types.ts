import { LucideIcon } from 'lucide-react';

export interface StepDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  skippable: boolean;
}

export interface StepProps {
  goBack: () => void;
  saving: boolean;
}

export interface InvitedUser {
  firstName: string;
  lastName: string;
  email: string;
  roleCode: string;
  roleName: string;
}

export interface ClassPathEntry {
  levelKey: string;
  name: string;
  code: string;
  order?: number;
}

export interface ClassItem {
  displayName: string;
  path: ClassPathEntry[];
}
