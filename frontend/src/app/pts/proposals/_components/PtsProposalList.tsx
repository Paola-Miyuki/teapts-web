'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '../proposals.module.css';
import ui from '@/components/ui.module.css';

import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import Pagination from './Pagination';
import PtsProposalCard from './PtsProposalCard';
import EmptyState from './EmptyState';

import type { PtsProposal } from './PtsProposalCard';
import type { Patient, Professional } from '../../novo/types';
import { listEligiblePatients, listProfessionals } from '../../novo/api/ptsApi';

// 1. Importamos a interface Account do sistema
import type { Account } from '@/lib/account';

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProposalsResponse = {
  data?: PtsProposal[];
  pagination?: PaginationData;
};

type ApiErrorResponse = {
  status?: string;
  message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const PAGE_LIMIT = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getApiMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

// 2. Definimos que o componente recebe { account } do tipo Account
export default function PtsProposalList({ account }: { account: Account }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientIdFromUrl = searchParams.get('patientId')?.trim() ?? '';
  const searchFromUrl = searchParams.get('search')?.trim() ?? '';

  const [proposals, setProposals] = useState<PtsProposal[] | null>(null);
  const [proposalError, setProposalError] = useState('');
  const [proposalRetryKey, setProposalRetryKey] = useState(0);

  const [professionalsMap, setProfessionalsMap] = useState<
    Record<string, Professional>
  >({});
  const [patientsMap, setPatientsMap] = useState<Record<string, Patient>>({});
  const [eligiblePatients, setEligiblePatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');
  const [supportRetryKey, setSupportRetryKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  });

  // Carrega pacientes e profissionais independentemente.
  useEffect(() => {
    const controller = new AbortController();

    listProfessionals(controller.signal)
      .then((profs) => {
        if (controller.signal.aborted) return;

        const loadedProfs: Professional[] = Array.isArray(profs)
          ? profs
          : ((profs as { data?: Professional[] })?.data ?? []);

        const pMap: Record<string, Professional> = {};

        loadedProfs.forEach((professional) => {
          if (professional?.id) pMap[professional.id] = professional;
        });

        setProfessionalsMap(pMap);
      })
      .catch(() => {
        // A falha não deve impedir a busca de pacientes.
      });

    listEligiblePatients(controller.signal)
      .then((pats) => {
        if (controller.signal.aborted) return;

        const loadedPatients: Patient[] = Array.isArray(pats)
          ? pats
          : ((pats as { data?: Patient[] })?.data ?? []);

        const patMap: Record<string, Patient> = {};

        loadedPatients.forEach((patient) => {
          if (patient?.id) patMap[patient.id] = patient;
        });

        setPatientsMap(patMap);
        setEligiblePatients(loadedPatients);
        setPatientsError('');
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        setPatientsError('Não foi possível carregar a lista de pacientes.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPatientsLoading(false);
        }
      });

    return () => controller.abort();
  }, [supportRetryKey]);

  const invalidPatientId =
    Boolean(patientIdFromUrl) && !UUID_PATTERN.test(patientIdFromUrl);

  let targetPatientId: string | null = null;
  let searchNoMatch = false;
  let searchMultipleMatches = false;

  if (!invalidPatientId) {
    if (patientIdFromUrl) {
      targetPatientId = patientIdFromUrl;
    } else if (account.patientProfileId) {
      targetPatientId = account.patientProfileId;
    } else if (searchFromUrl && !patientsLoading && !patientsError) {
      const term = searchFromUrl.toLocaleLowerCase('pt-BR');

      const matches = eligiblePatients.filter((patient) =>
        patient.name.toLocaleLowerCase('pt-BR').includes(term),
      );

      if (matches.length === 1) {
        targetPatientId = matches[0].id;
      } else if (matches.length === 0) {
        searchNoMatch = true;
      } else {
        searchMultipleMatches = true;
      }
    }
  }

  // 4. Consulta à API de propostas usando o targetPatientId validado
  useEffect(() => {
    if (!targetPatientId) {
      return;
    }

    let cancelled = false;

    const params = new URLSearchParams({
      patientId: targetPatientId,
      page: String(page),
      limit: String(PAGE_LIMIT),
    });

    fetch(`${API_URL}/pts/proposals?${params.toString()}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (cancelled) return;

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          const message = await getApiMessage(
            response,
            'Não foi possível consultar as propostas de PTS.',
          );
          if (cancelled) return;
          setProposals([]);
          setProposalError(message);
          return;
        }

        const result = (await response.json()) as
          ProposalsResponse | PtsProposal[];
        if (cancelled) return;

        setProposalError('');

        const loadedData: PtsProposal[] = Array.isArray(result)
          ? result
          : (result?.data ?? []);

        const loadedPagination: PaginationData = Array.isArray(result)
          ? {
              page: page,
              limit: PAGE_LIMIT,
              total: loadedData.length,
              totalPages: Math.ceil(loadedData.length / PAGE_LIMIT) || 1,
            }
          : {
              page: result?.pagination?.page ?? page,
              limit: result?.pagination?.limit ?? PAGE_LIMIT,
              total: result?.pagination?.total ?? loadedData.length,
              totalPages: result?.pagination?.totalPages ?? 1,
            };

        setProposals(loadedData);
        setPagination(loadedPagination);
      })
      .catch(() => {
        if (cancelled) return;
        setProposals([]);
        setProposalError('Não foi possível consultar as propostas de PTS.');
      });

    return () => {
      cancelled = true;
    };
  }, [page, proposalRetryKey, router, targetPatientId]);

  function handleProposalRetry() {
    setProposals(null);
    setProposalError('');
    setProposalRetryKey((current) => current + 1);
  }

  function handlePatientsRetry() {
    setPatientsError('');
    setPatientsLoading(true);
    setSupportRetryKey((current) => current + 1);
  }

  function handlePageChange(newPage: number) {
    setProposals(null);
    setProposalError('');
    setPage(newPage);
  }

  if (invalidPatientId) {
    return (
      <EmptyState
        title="Paciente inválido"
        message="O identificador do paciente informado não é válido."
      />
    );
  }

  if (
    searchFromUrl &&
    !patientIdFromUrl &&
    !account.patientProfileId &&
    patientsLoading
  ) {
    return <LoadingState />;
  }

  if (
    searchFromUrl &&
    !patientIdFromUrl &&
    !account.patientProfileId &&
    patientsError
  ) {
    return <ErrorState message={patientsError} onRetry={handlePatientsRetry} />;
  }

  if (searchMultipleMatches) {
    return (
      <EmptyState
        title="Mais de um paciente encontrado"
        message="Sua busca corresponde a vários pacientes. Digite um nome mais completo para identificar o paciente correto."
      />
    );
  }

  if (searchNoMatch) {
    return (
      <div className={styles.proposalsArea}>
        <div
          className={`${ui.card} ${ui.empty}`}
          style={{ marginTop: '1rem', padding: '2.5rem', textAlign: 'center' }}
        >
          <h2>Nenhum paciente encontrado</h2>
          <p>
            Não foi encontrado nenhum paciente com o nome{' '}
            <strong>&quot;{searchFromUrl}&quot;</strong>. Tente buscar de outra
            forma ou verifique a ortografia.
          </p>
        </div>
      </div>
    );
  }

  // Estado inicial vazio esperando ação (ou se apenas um termo vazio foi pesquisado)
  if (!targetPatientId && !searchFromUrl) {
    return (
      <div className={styles.proposalsArea}>
        <div className={styles.listHeader}>
          <div>
            <h2>Propostas disponíveis</h2>
            <p>Selecione um paciente para visualizar as propostas.</p>
          </div>
        </div>
        <div
          className={`${ui.card} ${ui.empty}`}
          style={{ marginTop: '1rem', padding: '2.5rem', textAlign: 'center' }}
        >
          <h2>Nenhum paciente selecionado</h2>
          <p>
            Utilize o formulário de busca para encontrar um paciente e
            visualizar as suas propostas de PTS correspondentes.
          </p>
        </div>
      </div>
    );
  }

  if (proposals === null) return <LoadingState />;
  if (proposalError)
    return <ErrorState message={proposalError} onRetry={handleProposalRetry} />;

  // Enriquecimento e mapeamento de dados dos cartões com informações dos profissionais
  const enrichedProposals = proposals.map((prop) => {
    const rawProp = prop as Record<string, unknown>;

    const profId =
      (rawProp.professionalId as string) ||
      (rawProp.responsibleId as string) ||
      (rawProp.creatorId as string) ||
      (rawProp.createdById as string) ||
      (rawProp.responsibleProfessionalId as string) ||
      (rawProp.responsible as { id?: string })?.id ||
      (rawProp.professional as { id?: string })?.id;

    const patId =
      (rawProp.patientId as string) ||
      (rawProp.patient as { id?: string })?.id ||
      targetPatientId;

    const matchedProf = profId ? professionalsMap[profId] : undefined;
    const matchedPat = patId ? patientsMap[patId] : undefined;

    const resolvedProfName =
      (rawProp.responsible as { name?: string })?.name ||
      (rawProp.professional as { name?: string })?.name ||
      (rawProp.responsibleProfessional as { name?: string })?.name ||
      (rawProp.professionalName as string) ||
      (rawProp.responsibleName as string) ||
      matchedProf?.name ||
      'Profissional não identificado';

    const resolvedSpecialism =
      (rawProp.responsible as { specialism?: { name?: string } })?.specialism
        ?.name ||
      (rawProp.professional as { specialism?: { name?: string } })?.specialism
        ?.name ||
      (rawProp.responsibleProfessional as { specialism?: { name?: string } })
        ?.specialism?.name ||
      matchedProf?.specialism?.name ||
      (matchedProf as { specialty?: string })?.specialty ||
      'Especialidade não informada';

    const resolvedPatientName =
      typeof rawProp.patient === 'object' &&
      rawProp.patient !== null &&
      'name' in rawProp.patient
        ? (rawProp.patient as { name: string }).name
        : typeof rawProp.patient === 'string'
          ? rawProp.patient
          : (rawProp.patientName as string) ||
            matchedPat?.name ||
            'Paciente não informado';

    return {
      ...prop,
      responsible: {
        name: resolvedProfName,
        specialism: {
          name: resolvedSpecialism,
        },
      },
      patient: {
        id: patId ?? '',
        name: resolvedPatientName,
      },
    };
  });

  const totalCount = pagination?.total ?? enrichedProposals.length;
  const currentPage = pagination?.page ?? page;
  const totalPagesCount = pagination?.totalPages ?? 1;

  return (
    <div className={styles.proposalsArea}>
      <div className={styles.listHeader}>
        <div>
          <h2>Propostas disponíveis</h2>
          <p>
            {totalCount}{' '}
            {totalCount === 1 ? 'proposta encontrada' : 'propostas encontradas'}
          </p>
        </div>
      </div>

      {enrichedProposals.length === 0 ? (
        <div
          className={`${ui.card} ${ui.empty}`}
          style={{ marginTop: '1rem', padding: '2.5rem', textAlign: 'center' }}
        >
          <h2>Nenhuma proposta encontrada</h2>
          <p>
            Não existem propostas correspondentes aos critérios pesquisados para
            este paciente.
          </p>
        </div>
      ) : (
        <div className={styles.proposalList}>
          {enrichedProposals.map((proposal) => (
            <PtsProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {totalPagesCount > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPagesCount}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
