import ActivePtsScreen from '@/app/pts/_components/ActivePtsScreen';

export const metadata = {
  title: 'Programa Terapêutico Singular · TEA-PTS',
};

type PatientPtsPageProps = {
  params: Promise<{
    patientId: string;
  }>;
};

// RFPTS004 – o profissional da equipe vê o PTS ativo do paciente escolhido.
export default async function PatientPtsPage({ params }: PatientPtsPageProps) {
  const { patientId } = await params;

  return (
    <ActivePtsScreen
      currentHref={`/patients/${patientId}/pts`}
      routePatientId={patientId}
    />
  );
}
