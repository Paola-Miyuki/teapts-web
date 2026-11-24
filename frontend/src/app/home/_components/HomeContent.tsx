'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

import Icon, { type IconName } from '@/components/Icon';
import type { Account, ProfileKind } from '@/lib/account';
import { formatDate } from '@/lib/format';
import { getAccountsWithoutProfile, getPatients } from '@/lib/patients';
import { can } from '@/lib/permissions';
import { getProfessionals } from '@/lib/professionals';
import { getProposals, type PtsProposal } from '@/lib/proposals';

type HomeContentProps = {
  account: Account;
  kind: ProfileKind;
  name: string;
};

// Contagem que ainda não chegou (ou falhou) fica sem número.
type Count = number | null;

const TODO_LIMIT = 5;

function Tile({
  href,
  icon,
  title,
  caption,
  count,
}: {
  href?: string;
  icon: IconName;
  title: string;
  caption: string;
  count?: Count;
}) {
  const content = (
    <>
      <span className="ux-tile-ic" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="ux-tile-body">
        <strong>{title}</strong>
        <small>{caption}</small>
      </span>
      {count !== undefined && count !== null && (
        <span className="ux-tile-n">{count}</span>
      )}
    </>
  );

  return href ? (
    <Link className="ux-tile" href={href}>
      {content}
    </Link>
  ) : (
    <div className="ux-tile">{content}</div>
  );
}

function Card({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ux-card" aria-labelledby={id}>
      <div className="ux-card-head">
        <div>
          <h2 id={id}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Carrega uma contagem (total da paginação) e devolve null enquanto não chega.
function useCount(load: (() => Promise<number>) | null) {
  const [count, setCount] = useState<Count>(null);

  useEffect(() => {
    let cancelled = false;

    load?.()
      .then((total) => {
        if (!cancelled) setCount(total);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });

    return () => {
      cancelled = true;
    };
    // `load` é estável por tela: a contagem carrega uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return count;
}

// Propostas em rascunho visíveis para a conta, as mais recentes primeiro.
function useProposals(enabled: boolean) {
  const [proposals, setProposals] = useState<PtsProposal[] | null>(null);
  const [total, setTotal] = useState<Count>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();

    getProposals({ page: 1, limit: TODO_LIMIT, signal: controller.signal })
      .then((response) => {
        setProposals(response.data);
        setTotal(response.pagination.total);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProposals([]);
      });

    return () => controller.abort();
  }, [enabled]);

  return { proposals, total };
}

function ProfessionalHome({ account }: { account: Account }) {
  const patients = useCount(() =>
    getPatients({ page: 1, limit: 1 }).then((r) => r.pagination.total),
  );
  const { proposals, total } = useProposals(true);

  return (
    <>
      <div className="ux-tiles">
        <Tile
          href="/patients"
          icon="patient"
          title="Pacientes"
          caption="Vinculados a você"
          count={patients}
        />
        <Tile
          href="/pts/proposals"
          icon="clipboard"
          title="Propostas"
          caption="Aguardando o paciente"
          count={total}
        />
      </div>

      <Card
        id="home-todo"
        title="Para fazer"
        action={
          can(account, 'createPts') && (
            <Link className="btn btn-sm btn-primary" href="/pts/novo">
              <Icon name="plus" className="icon-sm" />
              Criar proposta de PTS
            </Link>
          )
        }
      >
        {proposals && proposals.length > 0 ? (
          <ul className="mini-list ux-todos">
            {proposals.map((proposal) => (
              <li key={proposal.id} className="ux-todo">
                <span className="ux-tile-ic" aria-hidden="true">
                  <Icon name="clipboard" />
                </span>
                <span className="grow">
                  <strong>Proposta aguardando o paciente</strong>
                  <small>
                    {proposal.patient.name} · criada em{' '}
                    {formatDate(proposal.createdAt)}.
                  </small>
                </span>
                <Link className="btn btn-sm" href="/pts/proposals">
                  Ver proposta
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          proposals && <p className="muted">Nada para fazer agora.</p>
        )}
      </Card>
    </>
  );
}

function AdminHome() {
  const accounts = useCount(() =>
    getAccountsWithoutProfile().then((r) => r.pagination.total),
  );
  const patients = useCount(() =>
    getPatients({ page: 1, limit: 1 }).then((r) => r.pagination.total),
  );
  const professionals = useCount(() =>
    getProfessionals({ page: 1, limit: 1 }).then((r) => r.pagination.total),
  );

  return (
    <>
      <div className="ux-tiles">
        <Tile
          icon="accounts"
          title="Contas sem perfil"
          caption="Aguardando virar paciente ou profissional"
          count={accounts}
        />
        <Tile
          href="/patients"
          icon="patient"
          title="Pacientes"
          caption="Cadastrados"
          count={patients}
        />
        <Tile
          href="/professionals"
          icon="people"
          title="Profissionais"
          caption="Cadastrados"
          count={professionals}
        />
      </div>

      <Card id="home-admin" title="Atalhos">
        <div className="ux-tiles ux-tiles-sm">
          <Tile
            href="/patients"
            icon="plus"
            title="Adicionar paciente"
            caption="De uma conta existente"
          />
          <Tile
            href="/pts/proposals"
            icon="clipboard"
            title="Propostas"
            caption="Aprovar em nome do paciente"
          />
        </div>
      </Card>
    </>
  );
}

function PatientHome() {
  const { proposals } = useProposals(true);
  const latest = proposals?.[0];

  if (!proposals) {
    return null;
  }

  return latest ? (
    <section className="ux-card ux-next">
      <div>
        <h2>Proposta de PTS aguardando você</h2>
        <small className="ux-sub">
          <span className="ux-sublabel">Criada em:</span>{' '}
          {formatDate(latest.createdAt)}
        </small>
      </div>
      <Link className="btn btn-primary" href="/pts/proposals">
        Ver proposta
      </Link>
    </section>
  ) : (
    <section className="ux-card ux-empty-card">
      <h2>Nenhuma proposta aguardando você</h2>
    </section>
  );
}

function WaitingHome() {
  return (
    <section className="ux-card ux-empty-card">
      <span className="ux-tile-ic ux-big-ic" aria-hidden="true">
        <Icon name="clock" />
      </span>
      <h2>Aguardando aprovação</h2>
      <span className="badge draft">
        Sem perfil de paciente ou de profissional
      </span>
      <Link className="btn" href="/profile">
        Ir para Meu perfil
      </Link>
    </section>
  );
}

// Início de `inicio.html` (admin e profissional), `inicio-paciente.html` e
// `aguardando-perfil.html`. Só entram os blocos com dados na API.
export default function HomeContent({ account, kind, name }: HomeContentProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? '';

  return (
    <>
      <div className="heading">
        <div>
          <h1>{firstName ? `Boas-vindas, ${firstName}` : 'Boas-vindas'}</h1>
        </div>
      </div>

      {kind === 'admin' && <AdminHome />}
      {kind === 'professional' && <ProfessionalHome account={account} />}
      {kind === 'patient' && <PatientHome />}
      {kind === 'waiting' && <WaitingHome />}
    </>
  );
}
