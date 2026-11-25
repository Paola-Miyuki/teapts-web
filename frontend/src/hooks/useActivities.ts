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
    key: string;
    activities: Activity[] | null;
    pagination: ActivityPagination | null;
    error: unknown;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { status, executor, page, limit } = query;
  const requestKey = JSON.stringify([
    ptsId,
    status,
    executor,
    page,
    limit,
    reloadKey,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    getActivities(ptsId, { status, executor, page, limit }, controller.signal)
      .then(({ data, pagination: resultPagination }) => {
        setResult({
          key: requestKey,
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
          key: requestKey,
          activities: null,
          pagination: null,
          error: reason,
        });
      });

    return () => controller.abort();
  }, [ptsId, status, executor, page, limit, requestKey, reloadKey, router]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);
  const current = result?.key === requestKey ? result : null;

  return {
    activities: current?.activities ?? null,
    pagination: current?.pagination ?? null,
    error: current?.error ?? null,
    reload,
  };
}
