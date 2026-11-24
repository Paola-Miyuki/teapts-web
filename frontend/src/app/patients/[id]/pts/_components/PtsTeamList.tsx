'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  AddTeamMembersModal,
  ProfessionalProfile,
  PtsData,
} from './AddTeamMembersModal';

interface PtsTeamListProps {
  pts: PtsData;
  currentUserProfileIds: string[];
  isAdmin?: boolean;
  onPtsUpdated: (updatedPts: PtsData) => void;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export function PtsTeamList({
  pts,
  currentUserProfileIds,
  isAdmin = false,
  onPtsUpdated,
}: PtsTeamListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const canManageTeam = useMemo(() => {
    return isAdmin || currentUserProfileIds.includes(pts.responsible.id);
  }, [isAdmin, currentUserProfileIds, pts.responsible.id]);

  const excludedIds = useMemo(() => {
    return [pts.responsible.id, ...pts.team.map((member) => member.id)];
  }, [pts.responsible.id, pts.team]);

  const totalMembers = 1 + pts.team.length;

  const handleSuccess = (updatedPts: PtsData) => {
    onPtsUpdated(updatedPts);
    setSuccessFeedback('Equipe atualizada.');
  };

  return (
    <section
      aria-labelledby="equipe-multidisciplinar-heading"
      className="ux-tcard"
    >
      <div className="ux-tcard-head">
        <div>
          <h2 id="equipe-multidisciplinar-heading">Equipe multidisciplinar</h2>
          <p className="count">
            {totalMembers}{' '}
            {totalMembers === 1
              ? 'profissional vinculado ao cuidado deste paciente'
              : 'profissionais vinculados ao cuidado deste paciente'}
          </p>
        </div>

        {canManageTeam && (
          <div className="ux-tools">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setSuccessFeedback(null);
                setIsModalOpen(true);
              }}
            >
              <Icon name="plus" className="icon-sm" />
              Adicionar profissional
            </button>
          </div>
        )}
      </div>

      {successFeedback && (
        <div
          role="status"
          style={{
            margin: '0 1.25rem 1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {successFeedback}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Profissional</th>
              <th scope="col">Profissão</th>
              <th scope="col">Papel na equipe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="person">
                  <span className="avatar" aria-hidden="true">
                    {initial(pts.responsible.name)}
                  </span>
                  <div>
                    <strong>{pts.responsible.name}</strong>
                  </div>
                </div>
              </td>
              <td>{pts.responsible.specialism?.name || '—'}</td>
              <td>
                <span className="badge active">Responsável</span>
              </td>
            </tr>

            {pts.team.map((member: ProfessionalProfile) => (
              <tr key={member.id}>
                <td>
                  <div className="person">
                    <span className="avatar" aria-hidden="true">
                      {initial(member.name)}
                    </span>
                    <div>
                      <strong>{member.name}</strong>
                    </div>
                  </div>
                </td>
                <td>{member.specialism?.name || '—'}</td>
                <td>
                  <span className="badge">Membro</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManageTeam && (
        <AddTeamMembersModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          ptsId={pts.id}
          excludedIds={excludedIds}
          onSuccess={handleSuccess}
        />
      )}
    </section>
  );
}
