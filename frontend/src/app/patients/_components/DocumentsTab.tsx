'use client';

import Link from 'next/link';

import DocumentsTable from '@/components/documents/DocumentsTable';
import Icon from '@/components/Icon';
import {
  getDocuments,
  NON_TERM_CATEGORY_OPTIONS,
  type DocumentsQuery,
} from '@/lib/documents';

type DocumentsTabProps = {
  patientId: string;
  canUpload: boolean;
  canEditDocuments?: boolean;
};

// Aba "Documentos" de `paciente.html` (RFDOC003): os documentos do paciente,
// sem os termos, que ficam na aba "Termos e consentimentos".
export default function DocumentsTab({
  patientId,
  canUpload,
  canEditDocuments = false,
}: DocumentsTabProps) {
  return (
    <DocumentsTable
      id="docs"
      title="Documentos do paciente"
      singular="documento"
      plural="documentos"
      categories={NON_TERM_CATEGORY_OPTIONS}
      showUploader
      canEditDocuments={canEditDocuments}
      load={(query: DocumentsQuery, signal) =>
        getDocuments(patientId, query, signal)
      }
      action={
        canUpload ? (
          <Link
            className="btn btn-sm btn-primary"
            href={`/patients/${patientId}/documents/new`}
          >
            <Icon name="file" className="icon-sm" />
            Enviar documento
          </Link>
        ) : undefined
      }
    />
  );
}
