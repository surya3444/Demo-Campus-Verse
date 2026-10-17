'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { vacanciesApi, type Vacancy } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { VacancyEditor } from '@/components/careers/VacancyEditor';

export default function EditVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await vacanciesApi.get(id);
        if (active && res.success) setVacancy(res.data);
      } catch (err) {
        console.error(err);
        if (active) setError('Could not load this vacancy');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !vacancy) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error ?? 'Vacancy not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/careers/vacancies">
            <ArrowLeft className="h-4 w-4" /> Back to vacancies
          </Link>
        </Button>
      </div>
    );
  }

  return <VacancyEditor vacancy={vacancy} />;
}
