import PatientDetail from './PatientDetail';

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  return <PatientDetail id={patientId} />;
}
