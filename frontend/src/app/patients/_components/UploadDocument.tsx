'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import type { Account } from '@/lib/account';
import { createUploadUrl, uploadFile, validateFile } from '@/lib/documents';
import { can } from '@/lib/permissions';
import { getPatient } from '@/lib/patients';
import styles from '../patients.module.css';
import FileDropzone from './FileDropzone';

const SEND_ERROR = 'Não foi possível enviar o arquivo';
const LOAD_ERROR = 'Não foi possível carregar o paciente';

// Estados do envio: nada escolhido, pedindo a URL, enviando, enviado.
type Step = 'idle' | 'requesting' | 'uploading' | 'done';

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Passo "Arquivo" de `enviar-documento.html` (RFDOC001): valida tipo e tamanho,
// pede a URL, envia o arquivo com progresso e guarda a `fileKey`. Os dados do
// documento e a confirmação (RFDOC002) entram com a #130. O profissional só
// envia se tiver PTS ativo com o paciente (`readOnly` da API); a API confere.
export default function UploadDocument({
  account,
  patientId,
}: {
  account: Account;
  patientId: string;
}) {
  const router = useRouter();
  const isPatient = account.patientProfileId !== null;
  const [readOnly, setReadOnly] = useState<boolean | null>(
    isPatient || account.role === 'admin' ? false : null,
  );
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Admin e paciente não precisam da consulta do paciente.
  const needsPatient = readOnly === null;

  useEffect(() => {
    if (!needsPatient) {
      return;
    }

    const controller = new AbortController();

    getPatient(patientId, controller.signal)
      .then((patient) => setReadOnly(patient.readOnly))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setLoadError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : LOAD_ERROR,
        );
      });

    return () => controller.abort();
  }, [needsPatient, patientId, router]);

  // Cancela o envio em andamento ao sair da tela.
  useEffect(() => () => abortRef.current?.abort(), []);

  const cancelHref = isPatient ? '/home' : `/patients/${patientId}`;
  const busy = step === 'requesting' || step === 'uploading';

  async function send(chosen: File) {
    const controller = new AbortController();

    abortRef.current = controller;
    setError('');
    setProgress(0);

    // A URL vence em minutos: se o envio for recusado por isso, pede outra e
    // tenta de novo uma vez, sem o usuário escolher o arquivo outra vez.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        setStep('requesting');
        const created = await createUploadUrl(patientId, chosen);

        setStep('uploading');
        setProgress(0);
        await uploadFile(created.uploadUrl, chosen, {
          onProgress: setProgress,
          signal: controller.signal,
        });

        setFileKey(created.fileKey);
        setStep('done');
        return;
      } catch (reason: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        if (
          attempt === 0 &&
          reason instanceof ApiError &&
          reason.code === 'UPLOAD_URL_INVALID'
        ) {
          continue;
        }

        setStep('idle');
        setError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : SEND_ERROR,
        );
        return;
      }
    }
  }

  function handleSelect(chosen: File) {
    if (busy) {
      return;
    }

    const problem = validateFile(chosen);

    setFile(chosen);
    setFileKey('');

    if (problem) {
      setStep('idle');
      setError(problem);
      return;
    }

    void send(chosen);
  }

  if (loadError) {
    return (
      <div className={ui.empty} role="alert">
        <h2>Não foi possível carregar a tela</h2>
        <p>{loadError}</p>
        <Link href="/patients" className={`${ui.btn} ${ui.btnSecondary}`}>
          Voltar para os pacientes
        </Link>
      </div>
    );
  }

  if (needsPatient) {
    return (
      <div className={ui.empty} role="status">
        <p>Carregando...</p>
      </div>
    );
  }

  if (
    !can(account, 'uploadDocument', { patientReadOnly: readOnly ?? true }) ||
    (isPatient && account.patientProfileId !== patientId)
  ) {
    return (
      <div className={ui.empty} role="alert">
        <h2>Acesso restrito</h2>
        <p>Você não pode enviar documentos para este paciente.</p>
        <Link href="/home" className={`${ui.btn} ${ui.btnSecondary}`}>
          Voltar para o início
        </Link>
      </div>
    );
  }

  return (
    <form
      className="ux-formcard"
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="ux-formcard-head">
        <div>
          <h2>Novo documento</h2>
        </div>
      </div>

      <section className="ux-fsection">
        <header>
          <h3>Arquivo</h3>
        </header>
        <div>
          {error ? (
            <div
              role="alert"
              id="upload-error"
              className={`${ui.alert} ${ui.alertError}`}
            >
              <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
                <Icon name="alertCircle" />
              </div>
              <span>{error}</span>
            </div>
          ) : null}

          <FileDropzone
            disabled={busy}
            invalid={Boolean(error)}
            describedBy={error ? 'upload-error' : undefined}
            onSelect={handleSelect}
          />

          {file && !error && step !== 'idle' ? (
            <div className={styles.uploadStatus} aria-live="polite">
              <strong>{file.name}</strong>
              <small>{formatSize(file.size)}</small>

              {step === 'requesting' && <p>Preparando o envio...</p>}

              {step === 'uploading' && (
                <>
                  <progress
                    value={progress}
                    max={100}
                    aria-label="Progresso do envio"
                  />
                  <p>Enviando... {progress}%</p>
                </>
              )}

              {step === 'done' && (
                <p role="status">
                  <Icon name="checkCircle" className="icon-sm" /> Arquivo
                  enviado.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <div className="ux-formcard-foot">
        <Link className="btn" href={cancelHref}>
          Cancelar
        </Link>
        {/* O formulário de dados e a confirmação (RFDOC002) vêm com a #130. */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled
          aria-disabled="true"
          data-file-key={fileKey || undefined}
          title={
            fileKey
              ? 'O preenchimento dos dados do documento ainda não está disponível'
              : 'Envie um arquivo primeiro'
          }
        >
          Continuar
        </button>
      </div>
    </form>
  );
}
