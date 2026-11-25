'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import DocumentsTable from '@/components/documents/DocumentsTable';
import { useDocumentViewer } from '@/components/documents/DocumentViewer';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  getDocuments,
  TERM_CATEGORY_OPTIONS,
  type DocumentCategory,
  type DocumentListItem,
  type DocumentsQuery,
} from '@/lib/documents';
import { formatDate } from '@/lib/format';

type TermsTabProps = {
  patientId: string;
  canUpload: boolean;
};

const TERMS: {
  category: DocumentCategory;
  name: string;
  description: string;
  pending: string;
}[] = [
  {
    category: 'tcle',
    name: 'TCLE',
    description: 'Termo de consentimento livre e esclarecido',
    pending: 'Pendente',
  },
  {
    category: 'image_authorization',
    name: 'Autorização de uso de imagem',
    description: 'Autorização de uso de imagem',
    pending: 'Pendente · necessária para gravar sessões',
  },
];

type Situation = Partial<Record<DocumentCategory, DocumentListItem | null>>;

// Aba "Termos e consentimentos" de `paciente.html` (RFDOC003): a situação do
// TCLE e da autorização de imagem (enviado ou pendente) e a tabela dos termos.
export default function TermsTab({ patientId, canUpload }: TermsTabProps) {
  const router = useRouter();
  const viewer = useDocumentViewer();
  const [situation, setSituation] = useState<Situation | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    // O mais recente de cada termo: a lista vem do mais novo ao mais antigo.
    Promise.all(
      TERMS.map(({ category }) =>
        getDocuments(
          patientId,
          { page: 1, limit: 1, category: [category] },
          controller.signal,
        ),
      ),
    )
      .then((lists) => {
        setError('');
        setSituation(
          Object.fromEntries(
            TERMS.map(({ category }, index) => [
              category,
              lists[index].data[0] ?? null,
            ]),
          ),
        );
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : 'Não foi possível consultar a situação dos termos',
        );
      });

    return () => controller.abort();
  }, [patientId, retryKey, router]);

  const uploadHref = `/patients/${patientId}/documents/new`;

  return (
    <>
      <section className="ux-card" aria-labelledby="terms-status">
        <div className="ux-card-head">
          <div>
            <h2 id="terms-status">Situação dos termos</h2>
          </div>
        </div>

        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={() => setRetryKey((current) => current + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : !situation ? (
          <p role="status" aria-live="polite">
            Carregando situação dos termos...
          </p>
        ) : (
          <div className="ux-terms">
            {TERMS.map(({ category, name, description, pending }) => {
              const sent = situation[category] ?? null;

              return (
                <div className="ux-term" key={category}>
                  <span className={`ux-term-ic ${sent ? 'ok' : 'warn'}`}>
                    <Icon name={sent ? 'checkCircle' : 'alertCircle'} />
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <small>
                      {sent
                        ? `${description} · enviado em ${formatDate(sent.createdAt)}`
                        : pending}
                    </small>
                  </div>
                  {sent ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Ver ${name}`}
                      onClick={() => void viewer.open(sent.id, 'view')}
                    >
                      Ver
                    </button>
                  ) : (
                    canUpload && (
                      <Link
                        className="btn btn-sm btn-primary"
                        href={uploadHref}
                        aria-label={`Enviar ${name}`}
                      >
                        Enviar
                      </Link>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {viewer.error && (
          <p role="alert" className="hint">
            {viewer.error}
          </p>
        )}
      </section>

      <DocumentsTable
        id="terms"
        title="Termos enviados"
        singular="termo"
        plural="termos"
        categories={TERM_CATEGORY_OPTIONS}
        showUploader
        load={(query: DocumentsQuery, signal) =>
          getDocuments(patientId, query, signal)
        }
        action={
          canUpload ? (
            <Link className="btn btn-sm btn-primary" href={uploadHref}>
              <Icon name="file" className="icon-sm" />
              Enviar termo
            </Link>
          ) : undefined
        }
      />
    </>
  );
}
