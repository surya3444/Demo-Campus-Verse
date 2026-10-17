import type { Role, UserData, UserNode, HierarchyEdge } from '../types';

// Group users by a key
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = keyFn(item);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

export function transformToUserTreeData(
  roles: Role[],
  users: UserData[],
  onUserClick: (user: UserData) => void
): { nodes: UserNode[]; edges: HierarchyEdge[] } {
  // Create a map of role ID to role for quick lookup (handle both string and object IDs)
  const roleMap = new Map<string, Role>();
  roles.forEach((r) => {
    roleMap.set(String(r._id), r);
  });

  // Group users by role level
  const usersWithLevel = users.map((user) => {
    // First try to use the role already attached to user from API
    // Then fall back to looking up by roleId
    let role: Role | null = null;

    if (user.role) {
      // Use the role from user object, but get full role info from roles array
      role = roleMap.get(String(user.role._id)) || {
        _id: user.role._id,
        name: user.role.name,
        code: user.role.code,
        level: roleMap.get(String(user.role._id))?.level ?? 99,
        isSystemRole: true,
      };
    } else if (user.roleId) {
      role = roleMap.get(String(user.roleId)) || null;
    }

    return {
      user,
      role,
      level: role?.level ?? 99, // Put users without roles at bottom
    };
  });

  // Sort by level, then by name within each level
  usersWithLevel.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.user.profile.displayName.localeCompare(b.user.profile.displayName);
  });

  // Create nodes for each user
  const nodes: UserNode[] = usersWithLevel.map((item) => ({
    id: `user-${item.user._id}`,
    type: 'user' as const,
    data: {
      user: item.user,
      role: item.role,
      level: item.level,
      onUserClick,
    },
    position: { x: 0, y: 0 }, // Will be set by layout
  }));

  // Create edges between role levels (connecting representatives)
  // Group by level to create level-to-level connections
  const edges: HierarchyEdge[] = [];
  const usersByLevel = groupBy(usersWithLevel, (item) => String(item.level));
  const levels = Object.keys(usersByLevel)
    .map(Number)
    .sort((a, b) => a - b);

  // Connect first user of each level to first user of next level
  for (let i = 0; i < levels.length - 1; i++) {
    const currentLevel = levels[i];
    const nextLevel = levels[i + 1];
    const currentUsers = usersByLevel[currentLevel];
    const nextUsers = usersByLevel[nextLevel];

    if (currentUsers?.length && nextUsers?.length) {
      // Connect all users at current level to the "center" of next level
      // For cleaner visualization, connect from center of current to all of next
      const centerIdx = Math.floor(currentUsers.length / 2);
      const centerUser = currentUsers[centerIdx];

      nextUsers.forEach((nextUser) => {
        edges.push({
          id: `edge-${centerUser.user._id}-${nextUser.user._id}`,
          source: `user-${centerUser.user._id}`,
          target: `user-${nextUser.user._id}`,
          type: 'hierarchy',
        });
      });
    }
  }

  return { nodes, edges };
}

// Get role badge color based on level
export function getRoleBadgeColor(level: number): string {
  const colors: Record<number, string> = {
    0: 'bg-purple-500 text-white',
    1: 'bg-blue-500 text-white',
    2: 'bg-green-500 text-white',
    3: 'bg-emerald-500 text-white',
    4: 'bg-amber-500 text-white',
    5: 'bg-orange-500 text-white',
    6: 'bg-cyan-500 text-white',
    7: 'bg-teal-500 text-white',
    8: 'bg-slate-500 text-white',
    9: 'bg-gray-500 text-white',
  };
  return colors[level] || colors[9];
}

// Get card border color based on level
export function getCardBorderColor(level: number): string {
  const colors: Record<number, string> = {
    0: 'border-purple-400',
    1: 'border-blue-400',
    2: 'border-green-400',
    3: 'border-emerald-400',
    4: 'border-amber-400',
    5: 'border-orange-400',
    6: 'border-cyan-400',
    7: 'border-teal-400',
    8: 'border-slate-400',
    9: 'border-gray-400',
  };
  return colors[level] || colors[9];
}

// Get status badge styling
export function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'locked':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

// For minimap coloring
export function getLevelBgColor(level: number): string {
  const colors: Record<number, string> = {
    0: '#a855f7',
    1: '#3b82f6',
    2: '#22c55e',
    3: '#10b981',
    4: '#f59e0b',
    5: '#f97316',
    6: '#06b6d4',
    7: '#14b8a6',
    8: '#64748b',
    9: '#6b7280',
  };
  return colors[level] || colors[9];
}
