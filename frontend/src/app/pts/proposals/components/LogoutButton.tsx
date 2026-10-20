'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import styles from '../proposals.module.css';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      await fetch(`${API_URL}/auth/signout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      aria-label="Sair da conta"
      className={styles.logoutButton}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 3H4v18h5" />
        <path d="M10 12h11" />
        <path d="m17 8 4 4-4 4" />
      </svg>

      <span className={styles.logoutText}>
        {isLoading ? 'Saindo...' : 'Sair da conta'}
      </span>
    </button>
  );
}