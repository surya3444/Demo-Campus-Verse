'use client';

import { useQuery } from '@tanstack/react-query';
import { communicationsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone } from 'lucide-react';

export default function StudentAnnouncementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-announcements'],
    queryFn: () => communicationsApi.getAnnouncements({ limit: 50, status: 'published' }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const announcements = (data?.data || []) as Record<string, any>[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-muted-foreground">Stay updated with school announcements</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No announcements</h3>
            <p className="text-muted-foreground">No announcements have been published yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Card key={ann._id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{ann.title}</h3>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ann.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {(ann.content || ann.message) && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                        {ann.content || ann.message}
                      </p>
                    )}
                    {ann.priority && (
                      <Badge
                        variant={ann.priority === 'high' ? 'destructive' : 'secondary'}
                        className="mt-2 text-xs"
                      >
                        {ann.priority}
                      </Badge>
                    )}
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
