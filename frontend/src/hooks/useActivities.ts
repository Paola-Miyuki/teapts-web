import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  getActivities,
  type Activity,
  type ActivityListQuery,
  type ActivityPagination,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';

export function useActivities(ptsId: string, query: ActivityListQuery) {
  const router = useRouter();
  const [result, setResult] = useState<{
    ptsId: string;
    activities: Activity[] | null;
    pagination: ActivityPagination | null;
    error: unknown;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { status, executor, page, limit } = query;

  useEffect(() => {
    const controller = new AbortController();

    getActivities(ptsId, { status, executor, page, limit }, controller.signal)
      .then(({ data, pagination: resultPagination }) => {
        if (controller.signal.aborted) {
          return;
        }

        setResult({
          ptsId,
          activities: data,
          pagination: resultPagination,
          error: null,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setResult({
          ptsId,
          activities: null,
          pagination: null,
          error: reason,
        });
      });

    return () => controller.abort();
  }, [ptsId, status, executor, page, limit, reloadKey, router]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);
  // Ao filtrar, paginar ou recarregar, a lista anterior fica até a nova chegar.
  const current = result?.ptsId === ptsId ? result : null;

  return {
    activities: current?.activities ?? null,
    pagination: current?.pagination ?? null,
    error: current?.error ?? null,
    reload,
  };
}
