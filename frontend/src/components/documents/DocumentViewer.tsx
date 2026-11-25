'use client';

import { useCallback, useState } from 'react';

import Icon from '@/components/Icon';
import { ApiError } from '@/lib/api';
import {
  downloadUrlOf,
  getDocumentUrl,
  goToUrl,
  type DocumentListItem,
} from '@/lib/documents';

type Mode = 'view' | 'download';

// Abre ou baixa o arquivo pelo link temporário (RFDOC003): a URL vence em
// poucos minutos, então é pedida a cada clique.
export function useDocumentViewer() {
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = useCallback(async (documentId: string, mode: Mode) => {
    setError('');
    setBusyId(documentId);

    // A aba é aberta no clique, antes da resposta, para o navegador não a
    // tratar como pop-up; ela segue para o arquivo quando a URL chega.
    const tab = mode === 'view' ? window.open('', '_blank') : null;

    if (tab) {
      tab.opener = null;
    }

    try {
      const { url } = await getDocumentUrl(documentId);

      if (mode === 'view') {
        if (tab) {
          tab.location.href = url;
        } else {
          goToUrl(url);
        }
      } else {
        goToUrl(downloadUrlOf(url));
      }
    } catch (reason: unknown) {
      tab?.close();
      setError(
        reason instanceof ApiError && reason.apiMessage
          ? reason.apiMessage
          : 'Não foi possível abrir o documento',
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  return { error, busyId, open };
}

type DocumentViewerProps = {
  document: Pick<DocumentListItem, 'id' | 'title'>;
  viewer: ReturnType<typeof useDocumentViewer>;
};

// Itens "Visualizar" e "Baixar" do menu ⋮ da linha.
export default function DocumentViewer({
  document,
  viewer,
}: DocumentViewerProps) {
  const busy = viewer.busyId === document.id;

  return (
    <>
      <li>
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void viewer.open(document.id, 'view')}
        >
          <Icon name="eye" className="icon-sm" />
          Visualizar
        </button>
      </li>
      <li>
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void viewer.open(document.id, 'download')}
        >
          <Icon name="file" className="icon-sm" />
          Baixar
        </button>
      </li>
    </>
  );
}
