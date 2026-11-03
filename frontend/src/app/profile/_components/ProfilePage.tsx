'use client';

import { useState } from 'react';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account, ProfileKind } from '@/lib/account';
import AccountDetailsCard from './AccountDetailsCard';
import ChangePasswordForm from './ChangePasswordForm';
import styles from '../profile.module.css';

function renderProfile(
  account: Account,
  kind: ProfileKind,
  updateAccount: (account: Account) => void,
) {
  return (
    <ProfileContent
      account={account}
      kind={kind}
      updateAccount={updateAccount}
    />
  );
}

function ProfileContent({
  account,
  kind,
  updateAccount,
}: {
  account: Account;
  kind: ProfileKind;
  updateAccount: (account: Account) => void;
}) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  return (
    <>
      <div className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Minha conta</p>
          <h1>Meu perfil</h1>
          <p>Seus dados de identificação e os perfis associados à sua conta.</p>
        </div>
      </div>

      {feedback && (
        <div
          className={`${ui.alert} ${ui.alertSuccess} ${styles.feedback}`}
          role="status"
          aria-live="polite"
        >
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{feedback}</span>
        </div>
      )}

      <div className={styles.main}>
        <AccountDetailsCard
          account={account}
          kind={kind}
          onAccountUpdated={updateAccount}
          onFeedback={setFeedback}
          onResetPassword={() => {
            setFeedback('');
            setPasswordOpen(true);
          }}
        />

        {passwordOpen && (
          <ChangePasswordForm
            onCancel={() => setPasswordOpen(false)}
            onSuccess={() => {
              setPasswordOpen(false);
              setFeedback('Sua senha foi redefinida com sucesso.');
            }}
          />
        )}
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <AuthenticatedPage currentHref="/profile" breadcrumb="Meu perfil">
      {renderProfile}
    </AuthenticatedPage>
  );
}
