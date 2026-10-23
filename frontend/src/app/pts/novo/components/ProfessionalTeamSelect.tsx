import type { Professional } from '../types';
import { fieldCls, helpCls, labelCls } from '../styles';

interface Props {
  professionals: Professional[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

export function ProfessionalTeamSelect({
  professionals,
  selectedIds,
  onToggle,
  disabled,
}: Props) {
  const count = selectedIds.length;

  const summary =
    count === 0
      ? 'Selecione os profissionais'
      : `${count} ${
          count === 1
            ? 'profissional selecionado'
            : 'profissionais selecionados'
        }`;

  return (
    <div className={fieldCls}>
      <span id="team-label" className={labelCls}>
        Equipe multidisciplinar{' '}
        <span className="font-normal text-slate-500">(opcional)</span>
      </span>

      <details
        className="group rounded-xl border border-[#ddddda] bg-white"
        aria-labelledby="team-label"
      >
        <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between rounded-xl px-[15px] text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 [&::-webkit-details-marker]:hidden">
          <span className="text-slate-900">{summary}</span>

          <svg
            className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div className="max-h-64 overflow-y-auto rounded-b-xl border-t border-[#ddddda] bg-[#fafaf9] px-3 py-1.5">
          {professionals.length === 0 && (
            <p className="py-3 text-[13px] text-slate-500">
              Nenhum profissional disponível.
            </p>
          )}

          {professionals.map((p) => (
            <label
              key={p.id}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[14px] text-slate-800"
            >
              <input
                type="checkbox"
                name="team"
                value={p.id}
                checked={selectedIds.includes(p.id)}
                disabled={disabled}
                onChange={() => onToggle(p.id)}
                className="h-4 w-4 accent-slate-900"
              />

              <span>
                {p.name}
                <span className="block text-[12px] leading-4 text-slate-500">
                  {p.specialism.name}
                </span>
              </span>
            </label>
          ))}
        </div>
      </details>

      <p className={helpCls}>
        O responsável poderá adicionar ou remover profissionais depois.
      </p>
    </div>
  );
}
