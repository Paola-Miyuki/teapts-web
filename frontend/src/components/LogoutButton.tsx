'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api';

type LogoutButtonProps = {
  allSessions?: boolean;
  className?: string;
  children?: ReactNode;
};

export default function LogoutButton({
  allSessions = false,
  className,
  children = 'Sair',
}: LogoutButtonProps) {
  const router = useRouter();

  // Só é renderizado dentro do AppShell, depois que o useAccount carregou a conta.
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function finishLogout() {
    setErrorMessage('');

    router.replace('/login');
    router.refresh();
  }

  async function handleLogout() {
    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await apiFetch('/auth/logout', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          allSessions,
        }),
      });

      if (response.ok) {
        finishLogout();
        return;
      }

      let data: {
        message?: string;
      } = {};

      try {
        data = await response.json();
      } catch {
        // Resposta sem JSON
      }

      if (response.status === 401 || data.message === 'unauthorised') {
        finishLogout();
        return;
      }

      setErrorMessage('Não foi possível encerrar a sessão. Tente novamente.');
    } catch (error) {
      console.error('Erro ao realizar logout:', error);

      setErrorMessage(
        'Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={className}
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? 'Saindo...' : children}
      </button>

      {errorMessage && <p role="alert">{errorMessage}</p>}
    </div>
  );
}
