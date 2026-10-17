'use client';

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Mail,
  Phone,
  Shield,
  Building2,
  Loader2,
  Save,
  ArrowRight,
  Camera,
  GraduationCap,
} from 'lucide-react';

interface ProfileFormState {
  firstName: string;
  lastName: string;
  phone: string;
}

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    firstName: '',
    lastName: '',
    phone: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        phone: user.phone || '',
      });
      setLoading(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (form.phone && !/^\+?[1-9]\d{9,14}$/.test(form.phone)) {
      toast.error('Invalid phone number');
      return;
    }

    setSaving(true);
    try {
      const payload: { firstName?: string; lastName?: string; phone?: string } = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };
      if (form.phone) payload.phone = form.phone.trim();

      const response = await authApi.updateProfile(payload);
      if (response.success) {
        await refreshProfile();
        toast.success('Profile updated');
      } else {
        throw new Error('Update failed');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    if (uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be picked again later
    if (e.target) e.target.value = '';
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP, or GIF images are allowed');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Image must be 2MB or smaller');
      return;
    }

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setUploadingAvatar(true);

    try {
      const response = await authApi.uploadAvatar(file);
      if (response.success) {
        await refreshProfile();
        toast.success('Profile picture updated');
        setAvatarPreview(null); // clear preview now that user.profile.avatar is updated
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
      };
      const code = err.response?.data?.error?.code;
      if (err.response?.status === 503 || code === 'S3_NOT_CONFIGURED') {
        toast.error('File storage is not configured on this server', {
          description: 'Ask an admin to configure S3 to enable profile picture uploads.',
        });
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to upload picture');
      }
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      URL.revokeObjectURL(previewUrl);
    }
  };

  if (loading || !user) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Manage your personal information" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${form.firstName[0] || ''}${form.lastName[0] || ''}`.toUpperCase() || 'U';
  const isGroupOwner = user.roleCode === 'GROUP_OWNER';
  const displayedAvatar = avatarPreview || user.profile?.avatar || undefined;
  const branches = user.branches || [];

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your personal information" />

      {/* Cross-link to organization profile */}
      <Link
        href="/organization/settings"
        className="block rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors p-4"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {isGroupOwner ? 'Looking for the organization profile?' : 'Manage your organization'}
            </p>
            <p className="text-xs text-muted-foreground">
              Edit organization name, branding, contact info, and module settings →{' '}
              <span className="text-primary">/organization/settings</span>
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </div>
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Identity Card — avatar upload + role/org/branches at-a-glance */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Your identity and access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center text-center">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
              {/* Avatar with hover-overlay camera button */}
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="group relative h-24 w-24 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Change profile picture"
              >
                <Avatar className="h-24 w-24">
                  <AvatarImage src={displayedAvatar} alt={user.profile?.displayName} />
                  <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                </Avatar>
                {/* Hover overlay */}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="mt-2 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {uploadingAvatar ? 'Uploading...' : 'Change photo'}
              </button>

              <p className="mt-3 font-semibold">
                {user.profile?.displayName || `${form.firstName} ${form.lastName}`}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>

            {/* Role & Access section */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Role & Access
              </p>

              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="font-mono text-xs">
                  {user.roleCode}
                </Badge>
              </div>

              {user.tenant?.name && (
                <div className="flex items-start gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{user.tenant.name}</p>
                    <p className="text-[11px] text-muted-foreground">Organization</p>
                  </div>
                </div>
              )}

              {branches.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Branches ({branches.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {branches.map((b) => (
                        <Badge key={b._id} variant="secondary" className="text-[10px] font-normal">
                          {b.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Update your name and phone number</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={user.email} disabled className="pl-9" />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={form.phone ? '' : 'Not set — e.g. +919876543210'}
                    className="pl-9"
                  />
                </div>
                {!form.phone && (
                  <p className="text-xs text-muted-foreground">
                    Add a phone number for two-factor SMS and contact recovery.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
