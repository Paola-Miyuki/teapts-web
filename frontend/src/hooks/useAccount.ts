'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const LOAD_ERROR = 'Não foi possível carregar os dados da sua conta.';

// Consulta /me; sessão inválida volta para o login.
export function useAccount() {
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/me`, { credentials: 'include' })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          setError(LOAD_ERROR);
          return;
        }

        const result = (await response.json()) as Account;

        if (!cancelled) {
          setAccount(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(LOAD_ERROR);
        }
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
