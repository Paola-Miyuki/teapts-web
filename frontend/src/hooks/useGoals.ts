import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { getGoals, type Goal } from '@/lib/goals';

export function useGoals(ptsId: string) {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getGoals(ptsId, controller.signal)
      .then(({ data }) => {
        setError(null);
        setGoals(data);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(reason);
      });

    return () => controller.abort();
  }, [ptsId, reloadKey, router]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  return { goals, error, reload };
}
