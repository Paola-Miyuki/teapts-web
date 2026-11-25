'use client';

import Link from 'next/link';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import DocumentsTable from '@/components/documents/DocumentsTable';
import Icon from '@/components/Icon';
import {
  DOCUMENT_CATEGORIES,
  getMyDocuments,
  type DocumentsQuery,
} from '@/lib/documents';

function loadMine(query: DocumentsQuery, signal: AbortSignal) {
  return getMyDocuments(query, signal);
}

// "Documentos" do paciente (`meus-documentos.html`, RFDOC007): só os que ele
// mesmo enviou, para visualizar e baixar; não edita nem exclui, e não vê os
// da equipe (RN028).
export default function MyDocumentsPage() {
  return (
    <AuthenticatedPage
      currentHref="/my-documents"
      breadcrumb="Documentos"
      requiredAction="viewOwnCare"
    >
      {(account) =>
        account.patientProfileId ? (
          <>
            <div className="heading">
              <div>
                <h1>Documentos</h1>
              </div>
            </div>

            <DocumentsTable
              id="my-uploads"
              title="Meus documentos"
              singular="documento"
              plural="documentos"
              categories={DOCUMENT_CATEGORIES}
              showUploader={false}
              load={loadMine}
              action={
                <Link
                  className="btn btn-sm btn-primary"
                  href={`/patients/${account.patientProfileId}/documents/new`}
                >
                  <Icon name="file" className="icon-sm" />
                  Enviar documento
                </Link>
              }
            />
          </>
        ) : (
          <p>Perfil de paciente não encontrado</p>
        )
      }
    </AuthenticatedPage>
  );
}
