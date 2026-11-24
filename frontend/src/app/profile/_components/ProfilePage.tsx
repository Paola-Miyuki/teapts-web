'use client';

import { Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon, { type IconName } from '@/components/Icon';
import ui from '@/components/ui.module.css';
import {
  GENDER_LABELS,
  ROLE_LABELS,
  SEX_LABELS,
  type Account,
  type ProfileKind,
} from '@/lib/account';
import {
  formatAge,
  formatCpf,
  formatDate,
  formatDateOnly,
  formatPhone,
  initials,
} from '@/lib/format';
import { getProfessionals } from '@/lib/professionals';
import OwnSupportContacts from './OwnSupportContacts';

function Empty() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="ux-idfact-ic" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <dt>{label}</dt>
      <dd>{children || <Empty />}</dd>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <Empty />}</dd>
    </div>
  );
}

// Profissão do perfil profissional da conta (RN002: um por conta).
function useSpecialism(profileId: string | undefined) {
  const [specialism, setSpecialism] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) {
      return;
    }

    getProfessionals({ page: 1, limit: 1, ids: [profileId] })
      .then((response) =>
        setSpecialism(response.data[0]?.specialism.name ?? null),
      )
      .catch(() => setSpecialism(null));
  }, [profileId]);

  return specialism;
}

function ProfileContent({
  account,
  kind,
}: {
  account: Account;
  kind: ProfileKind;
}) {
  const searchParams = useSearchParams();
  const specialism = useSpecialism(
    kind === 'professional' ? account.professionalProfileIds[0] : undefined,
  );
  const updated = searchParams.get('updated') === '1';

  return (
    <>
      <div className="heading">
        <div>
          <h1>Meu perfil</h1>
        </div>
      </div>

      {updated && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>Seus dados foram atualizados com sucesso.</span>
        </div>
      )}

      <div className="ux-profile">
        <div className="ux-profile-side">
          <section className="ux-card ux-idcard" aria-labelledby="id-title">
            <div className="ux-idhead">
              <span className="photo" aria-hidden="true">
                {initials(account.name)}
              </span>
              <h2 id="id-title">{account.name}</h2>
              <span
                className={`badge ${kind === 'waiting' ? 'draft' : 'plain'}`}
              >
                {ROLE_LABELS[kind]}
              </span>
            </div>

            <div className="ux-idaccount">
              <h3>Dados da conta</h3>
              <dl className="ux-idfacts">
                <Fact icon="mail" label="E-mail">
                  {account.email}
                </Fact>
                <Fact icon="phone" label="Telefone">
                  {account.phone && formatPhone(account.phone)}
                </Fact>
                <Fact icon="calendar" label="Cadastro em">
                  {formatDate(account.createdAt)}
                </Fact>
                <Fact icon="clock" label="Última atualização">
                  {account.updatedAt && formatDate(account.updatedAt)}
                </Fact>
              </dl>
            </div>

            <Link className="btn btn-primary ux-idedit" href="/profile/edit">
              <Icon name="edit" className="icon-sm" />
              Editar perfil
            </Link>
          </section>
        </div>

        <div className="ux-profile-main">
          <section className="ux-card" aria-labelledby="personal-title">
            <div className="ux-card-head">
              <div>
                <h2 id="personal-title">Dados pessoais</h2>
              </div>
            </div>
            <dl className="ux-dl">
              <Item label="Nome social">{account.socialName}</Item>
              <Item label="Data de nascimento">
                {account.birthDate && formatDateOnly(account.birthDate)}
              </Item>
              <Item label="Idade">
                {account.birthDate && formatAge(account.birthDate)}
              </Item>
              <Item label="Sexo">{account.sex && SEX_LABELS[account.sex]}</Item>
              <Item label="Gênero">
                {account.gender && GENDER_LABELS[account.gender]}
              </Item>
              {kind !== 'admin' && (
                <Item label="CPF">{account.cpf && formatCpf(account.cpf)}</Item>
              )}
            </dl>
          </section>

          {kind === 'patient' && account.patientProfileId && (
            <OwnSupportContacts
              patientId={account.patientProfileId}
              patientName={account.name}
            />
          )}

          {kind === 'professional' && (
            <section className="ux-card" aria-labelledby="pro-title">
              <div className="ux-card-head">
                <div>
                  <h2 id="pro-title">Dados profissionais</h2>
                </div>
              </div>
              <dl className="ux-dl">
                <Item label="Profissão">{specialism}</Item>
              </dl>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

// Meu perfil de `meu-perfil.html`. Foto, dados do paciente, registro no
// conselho e exclusão da conta ainda não existem na API e ficam de fora; os
// contatos de suporte do paciente são só leitura (RFPAC003).
export default function ProfilePage() {
  return (
    <AuthenticatedPage currentHref="/profile" breadcrumb="Meu perfil">
      {(account, kind) => (
        <Suspense fallback={null}>
          <ProfileContent account={account} kind={kind} />
        </Suspense>
      )}
    </AuthenticatedPage>
  );
}
