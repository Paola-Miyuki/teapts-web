'use client';

import { useId, useRef, useState } from 'react';

import Icon from '@/components/Icon';
import { ACCEPTED_EXTENSIONS } from '@/lib/documents';

type FileDropzoneProps = {
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onSelect: (file: File) => void;
};

// Área "Selecione ou arraste um arquivo" de `enviar-documento.html`: o input
// de arquivo cobre a área inteira, então o clique e o arraste caem nele.
export default function FileDropzone({
  disabled = false,
  invalid = false,
  describedBy,
  onSelect,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    const file = files?.[0];

    if (file) {
      onSelect(file);
    }

    // Permite escolher o mesmo arquivo de novo depois de um erro.
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div
      className="upload-area"
      data-dragging={dragging || undefined}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDrop={() => setDragging(false)}
    >
      <Icon name="upload" className="icon" />
      <strong>Selecione ou arraste um arquivo</strong>
      <small>PDF, PNG, JPG, DOC ou DOCX, até 5 MB</small>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        aria-label="Arquivo"
        accept={ACCEPTED_EXTENSIONS}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => pick(event.target.files)}
      />
    </div>
  );
}
