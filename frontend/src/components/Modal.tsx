'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import Icon from '@/components/Icon';

type ModalProps = {
  open: boolean;
  id: string;
  title: string;
  description?: string;
  size?: 'sm' | 'md';
  // Enquanto true, o Esc, o clique no fundo e o X não fecham.
  busy?: boolean;
  footer: ReactNode;
  children?: ReactNode;
  onClose: () => void;
};

// Modal dos mockups (`dialog.modal`): <dialog> nativo, com showModal() para
// prender o foco; Esc, clique no fundo e o X fecham.
export default function Modal({
  open,
  id,
  title,
  description,
  size = 'md',
  busy = false,
  footer,
  children,
  onClose,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    if (!busy) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`modal${size === 'sm' ? ' modal-sm' : ''}`}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          close();
        }
      }}
    >
      {open && (
        <>
          <header className="modal-head">
            <div>
              <h2 id={`${id}-title`}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar"
              disabled={busy}
              onClick={close}
            >
              <Icon name="close" className="icon" />
            </button>
          </header>

          {children && <div className="modal-body">{children}</div>}

          <footer className="modal-foot">{footer}</footer>
        </>
      )}
    </dialog>
  );
}
