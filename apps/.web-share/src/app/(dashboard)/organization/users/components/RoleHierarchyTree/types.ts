import type { Node, Edge } from '@xyflow/react';

export interface UserData {
  _id: string;
  email: string;
  phone?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string;
    gender?: string;
  };
  roleId: string;
  role?: {
    _id: string;
    name: string;
    code: string;
  } | null;
  accessScope: {
    type: 'global' | 'institution' | 'branch' | 'department' | 'program';
    institutionIds?: string[];
    branchIds: string[];
    departmentIds?: string[];
  };
  status: 'active' | 'inactive' | 'locked' | 'pending';
  lastLogin?: string;
  createdAt: string;
}

export interface Role {
  _id: string;
  name: string;
  code: string;
  level: number;
  isSystemRole: boolean;
}

// User node data - each user is displayed as a card
export interface UserNodeData extends Record<string, unknown> {
  user: UserData;
  role: Role | null;
  level: number;
  onUserClick: (user: UserData) => void;
}

export type UserNode = Node<UserNodeData, 'user'>;
export type HierarchyEdge = Edge;

// Legacy types for backwards compatibility
export interface RoleNodeData extends Record<string, unknown> {
  role: Role;
  users: UserData[];
  isExpanded: boolean;
  level: number;
  onToggleExpand: () => void;
  onUserClick: (user: UserData) => void;
}

export type RoleNode = Node<RoleNodeData, 'role'>;
