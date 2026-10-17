'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Eye,
  Pencil,
  Trash2,
  Pin,
  Users,
  Plus,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { communicationsApi } from '@/lib/api';
import { toast } from 'sonner';

interface Announcement {
  _id: string;
  title: string;
  content: string;
  type?: string;
  priority?: string;
  targetAudience?: {
    type: string;
    classIds?: string[];
    sectionIds?: string[];
    departmentIds?: string[];
  };
  isPinned?: boolean;
  status: string;
  viewCount?: number;
  createdAt: string;
  createdBy?: { firstName?: string; lastName?: string; displayName?: string };
  publishedAt?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, variant = 'default', loading }: StatCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-gradient-to-br from-success to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
    primary: 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground',
  };
  const isColored = variant !== 'default';

  if (loading) {
    return (
      <Card className="border-0 shadow-elegant-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`border-0 shadow-elegant-md hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 ${variants[variant]}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-sm font-medium ${isColored ? 'text-white/70' : 'text-muted-foreground'}`}
            >
              {title}
            </p>
            <p className={`text-3xl font-bold mt-1 ${isColored ? '' : 'text-foreground'}`}>
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${isColored ? 'bg-white/10' : 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${isColored ? '' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page] = useState(1);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await communicationsApi.getAnnouncements({ page, limit: 20 });
      if (response.success) {
        setAnnouncements(response.data);
      }
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleDelete = async (id: string) => {
    try {
      const response = await communicationsApi.deleteAnnouncement(id);
      if (response.success) {
        toast.success('Announcement deleted');
        fetchAnnouncements();
      }
    } catch {
      toast.error('Failed to delete announcement');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const response = await communicationsApi.archiveAnnouncement(id);
      if (response.success) {
        toast.success('Announcement archived');
        fetchAnnouncements();
      }
    } catch {
      toast.error('Failed to archive announcement');
    }
  };

  const pinnedCount = announcements.filter((a) => a.isPinned).length;
  const totalViews = announcements.reduce((sum, a) => sum + (a.viewCount ?? 0), 0);

  const getAudienceLabel = (a: Announcement): string => {
    if (!a.targetAudience) return 'All';
    const type = a.targetAudience.type;
    return type === 'all' ? 'Everyone' : type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getCreatedByName = (a: Announcement): string => {
    if (!a.createdBy) return 'System';
    return (
      a.createdBy.displayName ||
      `${a.createdBy.firstName || ''} ${a.createdBy.lastName || ''}`.trim() ||
      'Staff'
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground mt-1">Create and manage school announcements</p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard
          title="Total Announcements"
          value={announcements.length}
          icon={MessageSquare}
          loading={isLoading}
        />
        <StatCard
          title="Pinned"
          value={pinnedCount}
          icon={Pin}
          variant="primary"
          loading={isLoading}
        />
        <StatCard
          title="Total Views"
          value={totalViews.toLocaleString()}
          icon={Eye}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          title="This Month"
          value={announcements.length}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-elegant-md">
              <CardContent className="py-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card className="border-0 shadow-elegant-md">
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No announcements yet</p>
            <p className="text-sm mt-1">Create your first announcement to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement, index) => (
            <Card
              key={announcement._id}
              className={`border-0 shadow-elegant-md hover:shadow-card-hover transition-all duration-300 group ${
                announcement.isPinned ? 'ring-2 ring-primary/20 bg-primary/5' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="py-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start gap-3">
                      {announcement.isPinned && (
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Pin className="h-4 w-4 text-primary fill-primary" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                          {announcement.title}
                        </h3>
                        <p className="text-muted-foreground mt-2 leading-relaxed">
                          {announcement.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-muted gap-1.5">
                        <Users className="h-3 w-3" />
                        {getAudienceLabel(announcement)}
                      </Badge>
                      {announcement.priority && announcement.priority !== 'low' && (
                        <Badge
                          variant="secondary"
                          className={
                            announcement.priority === 'urgent'
                              ? 'bg-destructive/10 text-destructive'
                              : announcement.priority === 'high'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-muted'
                          }
                        >
                          {announcement.priority}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {new Date(
                          announcement.publishedAt || announcement.createdAt
                        ).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span>by {getCreatedByName(announcement)}</span>
                      {announcement.viewCount !== undefined && (
                        <span className="flex items-center gap-1.5">
                          <Eye className="h-4 w-4" />
                          {announcement.viewCount} views
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg"
                      onClick={() => handleArchive(announcement._id)}
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-destructive hover:text-destructive"
                      onClick={() => handleDelete(announcement._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
