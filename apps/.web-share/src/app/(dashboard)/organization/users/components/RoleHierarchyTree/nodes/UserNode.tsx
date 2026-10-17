'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserNodeData } from '../types';
import { getRoleBadgeColor, getCardBorderColor, getStatusBadgeStyle } from '../utils/transformData';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface UserNodeProps {
  data: UserNodeData;
  selected?: boolean;
}

function UserNodeComponent({ data, selected }: UserNodeProps) {
  const { user, role, level, onUserClick } = data;
  const borderColor = getCardBorderColor(level);
  const roleBadgeColor = getRoleBadgeColor(level);
  const statusStyle = getStatusBadgeStyle(user.status);

  return (
    <Card
      className={cn(
        'w-[220px] shadow-lg transition-all duration-200 border-2 cursor-pointer hover:shadow-xl',
        borderColor,
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={() => onUserClick(user)}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !w-2 !h-2 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !w-2 !h-2 !border-2 !border-white"
      />

      <CardContent className="p-3">
        {/* Role badge at top */}
        <div className="flex justify-between items-start mb-2">
          <Badge className={cn('text-[10px] px-2 py-0.5', roleBadgeColor)}>
            {role?.name || 'No Role'}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusStyle)}>
            {user.status}
          </Badge>
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-10 w-10 border-2 border-white shadow">
            <AvatarImage src={user.profile.avatar} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
              {getInitials(user.profile.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{user.profile.displayName}</p>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mail className="h-3 w-3" />
              <p className="text-[10px] truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const UserNode = memo(UserNodeComponent);
