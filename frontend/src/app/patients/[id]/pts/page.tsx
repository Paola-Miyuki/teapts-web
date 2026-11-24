import ActivePtsScreen from '@/app/pts/_components/ActivePtsScreen';

export const metadata = {
  title: 'Programa Terapêutico Singular · TEA-PTS',
};

type PatientPtsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

// RFPTS004 – o profissional da equipe vê o PTS ativo do paciente escolhido.
export default async function PatientPtsPage({ params }: PatientPtsPageProps) {
  const { id } = await params;

  return (
    <ActivePtsScreen currentHref={`/patients/${id}/pts`} routePatientId={id} />
  );
}
