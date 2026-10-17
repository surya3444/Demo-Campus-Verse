import type { Socket } from 'socket.io';
import type { SocketData } from './socket';

const ADMIN_BYPASS_PREFIXES = [
  'teaching.',
  'courses.',
  'careerConnect.',
  'hostel.',
  'health.',
  'certificates.',
  'communications.',
  'inventory.',
  'expense.',
  'visitor.',
  'feedback.',
  'transport.',
];

export function socketHasPermission(socket: Socket, module: string, action: string): boolean {
  const d = socket.data as SocketData;
  if (!d?.permissions) return false;

  const isAdmin = (d.roleLevel ?? 99) <= 3;
  if (isAdmin && ADMIN_BYPASS_PREFIXES.some((p) => module.startsWith(p))) return true;

  const modulePermissions = d.permissions[module];
  return !!modulePermissions?.includes(action);
}

export function requireSocketPermission(socket: Socket, module: string, action: string): void {
  if (!socketHasPermission(socket, module, action)) {
    throw new Error('PERMISSION_DENIED');
  }
}
