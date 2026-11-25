'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import patientStyles from '@/app/patients/patients.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  categoryLabel,
  formatFileInfo,
  type DocumentCategory,
  type DocumentList,
  type DocumentListItem,
  type DocumentsQuery,
} from '@/lib/documents';
import { formatDate, formatDateOnly } from '@/lib/format';
import { SPECIALISMS } from '@/lib/professionals';
import DocumentViewer, { useDocumentViewer } from './DocumentViewer';
import EditDocumentDialog from '@/app/patients/_components/EditDocumentDialog';

type CategoryOption = { value: DocumentCategory; label: string };

type DocumentsTableProps = {
  // Prefixo dos ids da tabela (cada instância na página tem o seu).
  id: string;
  title: string;
  singular: string;
  plural: string;
  // Categorias do filtro; sem escolha, a consulta usa todas elas.
  categories: readonly CategoryOption[];
  // Quem enviou: a equipe vê a coluna "Enviado por"; o paciente, não.
  showUploader: boolean;
  load: (query: DocumentsQuery, signal: AbortSignal) => Promise<DocumentList>;
  // Link "Enviar documento" do cabeçalho.
  action?: ReactNode;
  // A edição só é habilitada nas tabelas do prontuário e para quem tem acesso.
  canEditDocuments?: boolean;
  // Muda para a tabela recarregar (ex.: depois de uma ação fora dela).
  reloadKey?: number;
  // Chamado a cada carga bem-sucedida.
  onLoaded?: (list: DocumentList) => void;
};

function EmptyCell() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function specialismLabel(specialism: string) {
  return SPECIALISMS.find(({ value }) => value === specialism)?.label ?? '';
}

function Issuer({ issuer }: { issuer: DocumentListItem['issuer'] }) {
  if (!issuer) {
    return <EmptyCell />;
  }

  const detail = issuer.outsideSystem
    ? 'Fora do sistema'
    : issuer.specialism
      ? specialismLabel(issuer.specialism)
      : '';

  return (
    <div className="stacked">
      {issuer.name}
      {issuer.institution ? ` (${issuer.institution})` : ''}
      {detail && <small>{detail}</small>}
    </div>
  );
}

// Tabela de documentos de `paciente.html` (abas Documentos e Termos e
// consentimentos) e de `meus-documentos.html`: busca pelo título, filtro de
// categoria, paginação e ações de consulta; Editar aparece só no prontuário
// para contas autorizadas (RFDOC003, RFDOC005, RFDOC007).
export default function DocumentsTable({
  id,
  title,
  singular,
  plural,
  categories,
  showUploader,
  load,
  action,
  canEditDocuments = false,
  reloadKey = 0,
  onLoaded,
}: DocumentsTableProps) {
  const router = useRouter();
  const search = useDebouncedSearch();
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PER_PAGE_OPTIONS[0]);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<DocumentList | null>(null);
  const [editing, setEditing] = useState<DocumentListItem | null>(null);
  const [error, setError] = useState('');
  const viewer = useDocumentViewer();

  const term = search.term;
  const categoryKey = selected.join(',');
  const queryKey = [term, categoryKey].join('\n');
  const [lastQuery, setLastQuery] = useState(queryKey);

  // Busca ou filtro novos voltam à página 1.
  if (lastQuery !== queryKey) {
    setLastQuery(queryKey);
    setPage(1);
  }

  // `load` costuma ser uma função nova a cada render; a consulta só refaz
  // quando o que a pessoa escolheu muda.
  const loadRef = useRef(load);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    loadRef.current = load;
    onLoadedRef.current = onLoaded;
  });

  useEffect(() => {
    const controller = new AbortController();
    const chosen = categoryKey
      ? (categoryKey.split(',') as DocumentCategory[])
      : categories.map(({ value }) => value);

    loadRef
      .current({ page, limit, q: term, category: chosen }, controller.signal)
      .then((response) => {
        setError('');
        setResult(response);
        onLoadedRef.current?.(response);
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
            : 'Não foi possível consultar os documentos',
        );
      });

    return () => controller.abort();
  }, [categories, categoryKey, limit, page, reloadKey, retryKey, router, term]);

  const hasFilters = categoryKey !== '';
  const filtered = Boolean(term || hasFilters);
  const total = result?.pagination.total ?? 0;
  const count = result
    ? `${total} ${total === 1 ? singular : plural}${filtered ? ' com os filtros atuais' : ''}`
    : 'Carregando...';

  return (
    <div className="ux-tcard">
      <div className="ux-tcard-head">
        <div>
          <h2>{title}</h2>
          <p className="count" aria-live="polite">
            {count}
          </p>
        </div>

        {action}
      </div>

      <div className="ux-toolbar">
        <label className="field">
          <span>Busca</span>
          <span className="with-icon">
            <Icon name="search" className="icon-sm" />
            <input
              className="input"
              type="search"
              placeholder="Título do documento"
              value={search.input}
              onChange={(event) => search.setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  search.commit();
                }

                if (event.key === 'Escape') {
                  search.clear();
                }
              }}
            />
          </span>
        </label>

        <div className="ux-tools">
          <button
            type="button"
            className="btn filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls={`${id}-more`}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Icon name="filter" className="icon-sm" />
            Filtros
          </button>

          {hasFilters && (
            <button
              type="button"
              className="btn"
              onClick={() => setSelected([])}
            >
              <Icon name="close" className="icon-sm" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="filter-more" id={`${id}-more`} hidden={!filtersOpen}>
        <MultiSelect
          label="Categoria"
          placeholder="Todas"
          options={categories.map(({ value, label }) => ({ value, label }))}
          value={selected}
          onChange={setSelected}
        />
      </div>

      {viewer.error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={ui.alertIcon}>
            <Icon name="alertCircle" />
          </div>
          <span>{viewer.error}</span>
        </div>
      )}

      {error ? (
        <div className={ui.empty} role="alert">
          <h2>Não foi possível carregar os documentos</h2>
          <p>{error}</p>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : !result ? (
        <div className={ui.empty} role="status" aria-live="polite">
          <div className={patientStyles.loader} />
          <p>Carregando documentos...</p>
        </div>
      ) : result.data.length === 0 ? (
        <div className={ui.empty}>
          <div className={ui.emptyIcon}>
            <Icon name={filtered ? 'search' : 'file'} />
          </div>
          <h2>
            {filtered
              ? 'Nenhum documento encontrado'
              : 'Nenhum documento enviado'}
          </h2>
          <p>
            {filtered
              ? 'Revise a busca ou limpe os filtros.'
              : 'Os documentos enviados aparecem aqui.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table" id={id}>
              <thead>
                <tr>
                  <th scope="col">Documento</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Emitido por</th>
                  <th scope="col">Data de emissão</th>
                  {showUploader && <th scope="col">Enviado por</th>}
                  <th scope="col">Enviado em</th>
                  <th scope="col" className="actions-col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <div className="person">
                        <span className="avatar ux-fileic" aria-hidden="true">
                          <Icon name="file" />
                        </span>
                        <div>
                          <strong>{document.title}</strong>
                          <small>
                            {formatFileInfo(
                              document.mimeType,
                              document.sizeBytes,
                            )}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{categoryLabel(document.category)}</td>
                    <td>
                      <Issuer issuer={document.issuer} />
                    </td>
                    <td className="num">
                      {document.issueDate ? (
                        formatDateOnly(document.issueDate)
                      ) : (
                        <EmptyCell />
                      )}
                    </td>
                    {showUploader && (
                      <td>
                        {document.uploadedBy.name}
                        {document.uploadedBy.isPatient ? ' (paciente)' : ''}
                      </td>
                    )}
                    <td className="num">{formatDate(document.createdAt)}</td>
                    <td className="actions-col">
                      <KebabMenu label={`Ações para ${document.title}`}>
                        <DocumentViewer document={document} viewer={viewer} />
                        {canEditDocuments && (
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => setEditing(document)}
                            >
                              <Icon name="edit" className="icon-sm" />
                              Editar
                            </button>
                          </li>
                        )}
                      </KebabMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            label={`Paginação de ${plural}`}
            page={result.pagination.page}
            limit={limit}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        </>
      )}
      {editing && (
        <EditDocumentDialog
          document={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setResult((current) =>
              current
                ? {
                    ...current,
                    data: current.data.map((item) =>
                      item.id === updated.id
                        ? {
                            ...item,
                            title: updated.title,
                            description: updated.description,
                          }
                        : item,
                    ),
                  }
                : current,
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
