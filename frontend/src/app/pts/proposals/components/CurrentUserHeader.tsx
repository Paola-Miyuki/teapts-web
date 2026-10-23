'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from '../proposals.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type CurrentAccount = {
  accountId?: string;
  name?: string;
  email?: string;
  role?: string;
  patientProfileId?: string | null;
  professionalProfileIds?: string[];
};

type UserInfo = {
  name: string;
  profile: string;
};

function getProfileLabel(account: CurrentAccount) {
  const role = account.role?.toLowerCase();

  if (role === 'admin' || role === 'administrator') {
    return 'Administrador';
  }

  if (account.patientProfileId) {
    return 'Paciente';
  }

  if (
    account.professionalProfileIds &&
    account.professionalProfileIds.length > 0
  ) {
    return 'Profissional';
  }

  if (role === 'patient') {
    return 'Paciente';
  }

  if (role === 'professional') {
    return 'Profissional';
  }

  return 'Usuário';
}

export default function CurrentUserHeader() {
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${API_URL}/me`, {
          credentials: 'include',
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          setUser({
            name: 'Usuário',
            profile: 'Perfil indisponível',
          });

          return;
        }

        const account = (await response.json()) as CurrentAccount;

        if (cancelled) {
          return;
        }

        setUser({
          name: account.name?.trim() || account.email?.trim() || 'Usuário',
          profile: getProfileLabel(account),
        });
      } catch {
        if (cancelled) {
          return;
        }

        setUser({
          name: 'Usuário',
          profile: 'Perfil indisponível',
        });
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Link href="/meu-perfil" className={styles.profileButton}>
      <span className={styles.profileAvatar}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3" />

          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      </span>

      <span className={styles.profileInfo}>
        {user ? (
          <>
            <strong>{user.name}</strong>
            <small>{user.profile}</small>
          </>
        ) : (
          <>
            <strong>Carregando...</strong>
            <small>Perfil</small>
          </>
        )}
      </span>

      <svg
        className={styles.profileChevron}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </Link>
  );
}
