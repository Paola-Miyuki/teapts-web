import AuthenticatedPage from '@/components/AuthenticatedPage';
import ui from '@/components/ui.module.css';
import Professionals from './components/Professionals';

export default function ProfissionaisPage() {
  return (
    <AuthenticatedPage currentHref="/profissionais" breadcrumb="Profissionais">
      <div className={ui.heading}>
        <p className={ui.eyebrow}>Equipe de cuidado</p>

        <h1>Profissionais</h1>

        <p>
          Consulte os profissionais cadastrados e encontre integrantes para
          compor a equipe multidisciplinar.
        </p>
      </div>

      <Professionals />
    </AuthenticatedPage>
  );
}
