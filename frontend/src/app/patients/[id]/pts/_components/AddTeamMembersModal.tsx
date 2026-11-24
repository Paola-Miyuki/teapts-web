'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';

export interface ProfessionalProfile {
  id: string;
  name: string;
  specialism: {
    id: string;
    name: string;
  };
}

export interface PtsData {
  id: string;
  status: string;
  responsible: ProfessionalProfile;
  team: ProfessionalProfile[];
}

interface AddTeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  ptsId: string;
  excludedIds: string[];
  onSuccess: (updatedPts: PtsData) => void;
}

interface DuplicateAccountErrorBody {
  status?: string;
  message?: string;
  professionalIds?: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export function AddTeamMembersModal({
  isOpen,
  onClose,
  ptsId,
  excludedIds,
  onSuccess,
}: AddTeamMembersModalProps) {
  const router = useRouter();

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [conflictIds, setConflictIds] = useState<string[]>([]);

  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSearchInput('');
      setDebouncedTerm('');
      setSelectedIds([]);
      setConflictIds([]);
      setErrorMessage(null);
    }
  }

  const excludedKey = excludedIds.join(',');
  const trimmedInput = searchInput.trim();
  const isTooShort = trimmedInput.length === 1;

  // Debounce simples e sem loops de renderização
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(trimmedInput.length >= 2 ? trimmedInput : '');
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmedInput]);

  // Busca profissionais disponíveis
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const controller = new AbortController();
    const excludedSet = new Set(excludedKey ? excludedKey.split(',') : []);

    async function fetchProfessionals() {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const query = new URLSearchParams({
          name: debouncedTerm,
          page: '1',
          limit: '10',
        });

        const response = await fetch(
          `${API_BASE_URL}/professionals?${query.toString()}`,
          {
            credentials: 'include',
            signal: controller.signal,
          },
        );

        if (cancelled) return;

        if (!response) {
          throw new Error(
            'Resposta inválida do servidor ao buscar profissionais.',
          );
        }

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          const errData =
            typeof response.json === 'function'
              ? ((await response.json().catch(() => null)) as {
                  message?: string;
                } | null)
              : null;
          throw new Error(errData?.message || 'Erro ao buscar profissionais.');
        }

        const data =
          typeof response.json === 'function' ? await response.json() : [];
        if (cancelled) return;

        const items: ProfessionalProfile[] = Array.isArray(data)
          ? data
          : data?.data || [];

        const available = items.filter((prof) => !excludedSet.has(prof.id));
        setProfessionals(available);
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          setErrorMessage(
            err.message || 'Falha ao carregar lista de profissionais.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }

    fetchProfessionals();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, debouncedTerm, excludedKey, router]);

  const handleToggleSelection = (id: string) => {
    setErrorMessage(null);
    setConflictIds((prev) => prev.filter((item) => item !== id));

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setDebouncedTerm(trimmedInput.length >= 2 ? trimmedInput : '');
    }
    if (e.key === 'Escape') {
      setSearchInput('');
      setDebouncedTerm('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIds.length === 0) {
      setErrorMessage(
        'Selecione ao menos um profissional para adicionar à equipe.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setConflictIds([]);

    try {
      const response = await fetch(`${API_BASE_URL}/pts/${ptsId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ professionalIds: selectedIds }),
      });

      if (!response) {
        setErrorMessage('Resposta inválida do servidor ao salvar a equipe.');
        return;
      }

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      const data =
        typeof response.json === 'function'
          ? ((await response
              .json()
              .catch(() => ({}))) as DuplicateAccountErrorBody &
              Partial<PtsData>)
          : ({} as DuplicateAccountErrorBody & Partial<PtsData>);

      if (!response.ok) {
        if (
          response.status === 400 &&
          data.status === 'TEAM_DUPLICATE_ACCOUNT'
        ) {
          setConflictIds(
            Array.isArray(data.professionalIds) ? data.professionalIds : [],
          );
          setErrorMessage(
            data.message ||
              'A equipe não pode ter mais de um perfil da mesma conta, contando o responsável.',
          );
          return;
        }

        setErrorMessage(
          data.message || 'Não foi possível adicionar os profissionais.',
        );
        return;
      }

      onSuccess(data as PtsData);
      onClose();
    } catch {
      setErrorMessage('Erro de conexão ao salvar a equipe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      id="add-team-members-modal"
      title="Adicionar profissional à equipe"
      onClose={isSubmitting ? () => {} : onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="add-team-members-form"
            className="btn primary"
            disabled={isSubmitting || selectedIds.length === 0}
          >
            {isSubmitting ? 'Adicionando...' : 'Adicionar'}
          </button>
        </>
      }
    >
      <form
        id="add-team-members-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <label className="field">
          <span>Buscar profissional por nome</span>
          <span className="with-icon">
            <Icon name="search" className="icon-sm" />
            <input
              id="professional-search"
              className="input"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Nome do profissional"
            />
          </span>
        </label>

        {isTooShort && (
          <p className="count" style={{ marginTop: '-0.5rem' }}>
            Digite pelo menos 2 caracteres para filtrar pelo nome.
          </p>
        )}

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          className="table-wrap"
          style={{ maxHeight: '18rem', overflowY: 'auto' }}
        >
          {isSearching ? (
            <p
              className="count"
              role="status"
              style={{ padding: '1.5rem', textAlign: 'center' }}
            >
              Buscando profissionais...
            </p>
          ) : professionals.length === 0 ? (
            <p
              className="count"
              style={{ padding: '1.5rem', textAlign: 'center' }}
            >
              Nenhum profissional disponível encontrado.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '2.5rem' }}>
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <th scope="col">Profissional</th>
                  <th scope="col">Profissão</th>
                </tr>
              </thead>
              <tbody>
                {professionals.map((prof) => {
                  const isChecked = selectedIds.includes(prof.id);
                  const hasConflict = conflictIds.includes(prof.id);
                  const checkboxId = `select-prof-${prof.id}`;

                  return (
                    <tr
                      key={prof.id}
                      style={
                        hasConflict ? { backgroundColor: '#fef2f2' } : undefined
                      }
                    >
                      <td>
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelection(prof.id)}
                          disabled={isSubmitting}
                          aria-label={`Selecionar ${prof.name}`}
                        />
                      </td>
                      <td>
                        <label
                          htmlFor={checkboxId}
                          className="person"
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="avatar" aria-hidden="true">
                            {initial(prof.name)}
                          </span>
                          <div>
                            <strong>{prof.name}</strong>
                            {hasConflict && (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '0.75rem',
                                  color: '#b91c1c',
                                  fontWeight: 500,
                                }}
                              >
                                Mesma conta já vinculada
                              </span>
                            )}
                          </div>
                        </label>
                      </td>
                      <td>{prof.specialism?.name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </form>
    </Modal>
  );
}
