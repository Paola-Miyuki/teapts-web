import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getActivities, type Activity } from '@/lib/activities';
import { ApiError } from '@/lib/api';

export function useActivities(ptsId: string) {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getActivities(ptsId, controller.signal)
      .then(({ data }) => {
        setError(null);
        setActivities(data);
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

  return { activities, error, reload };
}
