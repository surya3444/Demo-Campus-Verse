'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, ArrowRight, ArrowLeft, Loader2, SkipForward, Plus, X, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { organizationApi } from '@/lib/api';
import type { InvitedUser } from './types';

interface AssignableRole {
  _id: string;
  code: string;
  name: string;
}

interface InviteTeamStepProps {
  saving: boolean;
  setSaving: (saving: boolean) => void;
  branchId: string | null;
  branchName?: string;
  onSave: (invitedUsers: InvitedUser[]) => void;
  onSkip: () => void;
  goBack: () => void;
}

const ALLOWED_ROLE_CODES = ['ORG_ADMIN', 'BRANCH_ADMIN'];

export function InviteTeamStep({
  saving,
  setSaving,
  branchId,
  branchName,
  onSave,
  onSkip,
  goBack,
}: InviteTeamStepProps) {
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [stagedUsers, setStagedUsers] = useState<(InvitedUser & { roleId: string })[]>([]);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await organizationApi.getAssignableRoles();
        if (response.success) {
          const filtered = response.data.filter((r: AssignableRole) =>
            ALLOWED_ROLE_CODES.includes(r.code)
          );
          setRoles(filtered);
          if (filtered.length > 0) {
            setSelectedRoleId(filtered[0]._id);
          }
        }
      } catch {
        toast.error('Failed to load roles');
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchRoles();
  }, []);

  const selectedRole = roles.find((r) => r._id === selectedRoleId);

  const validateAndAdd = () => {
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Valid email is required');
      return;
    }
    if (!selectedRoleId || !selectedRole) {
      toast.error('Please select a role');
      return;
    }
    if (stagedUsers.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      toast.error('This email is already added');
      return;
    }

    setStagedUsers((prev) => [
      ...prev,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        roleCode: selectedRole.code,
        roleName: selectedRole.name,
        roleId: selectedRole._id,
      },
    ]);

    // Reset form
    setFirstName('');
    setLastName('');
    setEmail('');
  };

  const removeUser = (index: number) => {
    setStagedUsers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (stagedUsers.length === 0) {
      toast.error('Add at least one team member or skip this step');
      return;
    }

    setSaving(true);
    const successful: InvitedUser[] = [];
    let failCount = 0;

    for (const user of stagedUsers) {
      try {
        const accessScope =
          user.roleCode === 'BRANCH_ADMIN'
            ? { type: 'branch' as const, branchIds: branchId ? [branchId] : [] }
            : { type: 'global' as const, branchIds: [] };

        await organizationApi.createUser({
          email: user.email,
          profile: { firstName: user.firstName, lastName: user.lastName },
          roleId: user.roleId,
          accessScope,
        });

        successful.push({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roleCode: user.roleCode,
          roleName: user.roleName,
        });
      } catch {
        failCount++;
      }
    }

    setSaving(false);

    if (failCount === 0) {
      toast.success(`Invited ${successful.length} team member${successful.length > 1 ? 's' : ''}!`);
    } else if (successful.length > 0) {
      toast.warning(`Invited ${successful.length} of ${stagedUsers.length}. ${failCount} failed.`);
    } else {
      toast.error('Failed to invite team members. Please try again.');
      return;
    }

    onSave(successful);
  };

  if (loadingRoles) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-10 pb-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Invite Your Team</CardTitle>
        <CardDescription>
          Add admins and branch heads who&apos;ll manage the platform. They&apos;ll receive login
          credentials via email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add user form */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    validateAndAdd();
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedRole?.code === 'BRANCH_ADMIN' && branchName && (
            <p className="text-sm text-muted-foreground">
              Will be assigned to branch:{' '}
              <span className="font-medium text-foreground">{branchName}</span>
            </p>
          )}
          <Button variant="outline" size="sm" onClick={validateAndAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add to List
          </Button>
        </div>

        {/* Staged users list */}
        {stagedUsers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {stagedUsers.length} member{stagedUsers.length > 1 ? 's' : ''} to invite
            </Label>
            <div className="space-y-2">
              {stagedUsers.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {user.roleName}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeUser(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={goBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSkip} className="gap-1.5">
              <SkipForward className="h-4 w-4" /> Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || stagedUsers.length === 0}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Invite & Continue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
