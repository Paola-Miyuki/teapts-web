'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { PtsTeamList } from './_components/PtsTeamList';
import { PtsData } from './_components/AddTeamMembersModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  planning: 'Em planejamento',
  running: 'Em andamento',
  concluded: 'Concluído',
  cancelled: 'Cancelado',
  rejected: 'Rejeitado',
};

export default function PatientIdPtsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const patientId = params?.id;

  const [pts, setPts] = useState<PtsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!patientId) return;

    let cancelled = false;

    async function loadPts() {
      try {
        const ptsRes = await fetch(
          `${API_BASE_URL}/pts/active?patientId=${patientId}`,
          { credentials: 'include' },
        );

        if (cancelled) return;

        if (ptsRes.status === 401) {
          router.replace('/login');
          return;
        }

        if (!ptsRes.ok) {
          const errData = (await ptsRes.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(errData?.message || 'Erro ao carregar PTS ativo.');
        }

        const ptsData = (await ptsRes.json()) as PtsData;
        if (!cancelled) {
          setError(null);
          setPts(ptsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar os dados do PTS.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPts();
    return () => {
      cancelled = true;
    };
  }, [patientId, retryKey, router]);

  return (
    <AuthenticatedPage
      currentHref="/patients"
      breadcrumb="Projeto Terapêutico Singular"
    >
      {(account) => (
        <>
          <div className="heading">
            <div>
              <h1>Projeto Terapêutico Singular</h1>
              {pts && (
                <p>
                  Situação:{' '}
                  <span className="badge active">
                    {STATUS_LABELS[pts.status] ?? pts.status}
                  </span>
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="ux-tcard">
              <div className={ui.empty} role="status">
                <p>Carregando PTS ativo...</p>
              </div>
            </div>
          ) : error || !pts ? (
            <div className="ux-tcard">
              <div className={ui.empty} role="alert">
                <div className={ui.emptyIcon}>
                  <Icon name="people" />
                </div>
                <h2>Não foi possível exibir o PTS ativo</h2>
                <p>{error || 'PTS ativo não encontrado.'}</p>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSecondary}`}
                  onClick={() => {
                    setLoading(true);
                    setRetryKey((current) => current + 1);
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : (
            <PtsTeamList
              pts={pts}
              currentUserProfileIds={account.professionalProfileIds ?? []}
              isAdmin={account.role === 'admin'}
              onPtsUpdated={(updatedPts) => setPts(updatedPts)}
            />
          )}
        </>
      )}
    </AuthenticatedPage>
  );
}
