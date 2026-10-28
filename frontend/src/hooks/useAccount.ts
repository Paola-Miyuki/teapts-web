'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getMe, type Account } from '@/lib/account';
import { ApiError } from '@/lib/api';

const LOAD_ERROR = 'Não foi possível carregar os dados da sua conta.';

// Consulta /me; sessão inválida volta para o login.
export function useAccount() {
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((result) => {
        if (!cancelled) {
          setAccount(result);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setError(LOAD_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey, router]);

  function retry() {
    setError('');
    setRetryKey((current) => current + 1);
  }

  return { account, error, retry };
}
