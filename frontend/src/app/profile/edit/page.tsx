'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import ProfileEditForm from '../_components/ProfileEditForm';

export default function ProfileEditRoute() {
  return (
    <AuthenticatedPage
      currentHref="/profile/edit"
      breadcrumb={[
        { label: 'Meu perfil', href: '/profile' },
        { label: 'Editar perfil' },
      ]}
    >
      {(account, _kind, updateAccount) => (
        <>
          <div className="heading">
            <div>
              <h1>Editar perfil</h1>
            </div>
          </div>

          <ProfileEditForm account={account} onAccountUpdated={updateAccount} />
        </>
      )}
    </AuthenticatedPage>
  );
}
