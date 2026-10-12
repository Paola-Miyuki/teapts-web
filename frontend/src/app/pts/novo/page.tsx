'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PatientOption, ProfessionalOption, CreatePtsPayload, PtsSuccessResponse } from '@/types/pts';
import { PatientSelect } from './PatientSelect';
import { SocialSituationInput } from './SocialSituationInput';
import { ProfessionalTeamSelect } from './ProfessionalTeamSelect';
import { SubmitButton } from './SubmitButton';
import { ErrorMessage } from './ErrorMessage';

export default function CreatePtsPage() {
  const router = useRouter();


  const [patientId, setPatientId] = useState<number | ''>('');
  const [socialSituation, setSocialSituation] = useState<string>('');
  const [teamProfessionalIds, setTeamProfessionalIds] = useState<number[]>([]);

 
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  
  const currentProfessionalId = 10;

useEffect(() => {
  async function loadFormData() {
    try {
      setIsFetching(true);
      setErrorMessage(null);

      const [patientsRes, professionalsRes] = await Promise.all([
        fetch('/api/accounts?role=PATIENT'),
        fetch('/api/accounts?role=PROFESSIONAL'),
      ]);

      if (!patientsRes.ok || !professionalsRes.ok) {
        throw new Error('Falha ao obter lista de pacientes ou profissionais.');
      }

      const patientsData = await patientsRes.json();
      const professionalsData = await professionalsRes.json();

      setPatients(patientsData);
      setProfessionals(professionalsData);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Erro ao carregar dados para inicialização do formulário.',
      );
    } finally {
      setIsFetching(false);
    }
  }

  loadFormData();
}, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!patientId) {
      setErrorMessage('Por favor, selecione um paciente.');
      return;
    }

    if (!socialSituation.trim()) {
      setErrorMessage('A situação social é obrigatória.');
      return;
    }

    setIsLoading(true);

    const payload: CreatePtsPayload = {
      professionalId: currentProfessionalId,
      patientId: Number(patientId),
      socialSituation: socialSituation.trim(),
      teamProfessionalIds,
    };

    try {
      const response = await fetch('/api/pts', { // Endpoint POST /pts
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Trata os erros mapeados retornados pela API
        if (data.status === 'PTS_ACTIVE_EXISTS') {
          throw new Error('O paciente já possui um PTS aprovado e ativo.');
        } else if (response.status === 403 || data.status === 'UNAUTHORIZED') {
          throw new Error('Você não possui autorização para utilizar o perfil informado.');
        } else {
          throw new Error(data.message || 'Erro inesperado ao criar proposta de PTS.');
        }
      }

      const resData = data as PtsSuccessResponse;
      setSuccessMessage(
        `Proposta criada com sucesso em estado ${resData.status}! Redirecionando...`
      );

      // Limpar formulário ou redirecionar
      setTimeout(() => {
        router.push(`/pts/propostas`);
      }, 2000);

    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div style={{ padding: '24px' }}>Carregando dados da página...</div>;
  }

  return (
    <section className="section" style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <div className="heading" style={{ marginBottom: '24px' }}>
        <p className="eyebrow" style={{ color: '#666', fontSize: '0.875rem' }}>Nova Proposta</p>
        <h1>Criar Proposta de PTS</h1>
        <p>Preencha os dados abaixo para iniciar o Programa Terapêutico Singular.</p>
      </div>

      <ErrorMessage message={errorMessage} />

      {successMessage && (
        <div className="notice notice-success" style={{ color: '#2e7d32', backgroundColor: '#e8f5e9', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          <strong>Sucesso!</strong> {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <PatientSelect
          value={patientId}
          options={patients}
          onChange={setPatientId}
          disabled={isLoading}
        />

        <SocialSituationInput
          value={socialSituation}
          onChange={setSocialSituation}
          disabled={isLoading}
        />

        <ProfessionalTeamSelect
          selectedIds={teamProfessionalIds}
          options={professionals}
          onChange={setTeamProfessionalIds}
          disabled={isLoading}
        />

        <div className="form-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <SubmitButton isLoading={isLoading} />
        </div>
      </form>
    </section>
  );
}