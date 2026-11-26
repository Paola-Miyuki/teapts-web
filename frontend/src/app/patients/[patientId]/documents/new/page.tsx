import UploadDocumentPage from './UploadDocumentPage';

export const metadata = {
  title: 'Enviar documento · TEA-PTS',
};

export default async function NewPatientDocumentPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  return <UploadDocumentPage patientId={patientId} />;
}
