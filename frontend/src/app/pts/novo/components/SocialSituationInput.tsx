import { fieldCls, fieldErrorCls, helpCls, labelCls, textareaCls } from '../styles';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SocialSituationInput({ value, onChange, error, disabled }: Props) {
  return (
    <div className={fieldCls}>
      <label htmlFor="social" className={labelCls}>
        Situação social
      </label>
      <textarea
        id="social"
        name="social"
        required
        value={value}
        disabled={disabled}
        placeholder="Descreva a situação social do paciente"
        aria-invalid={!!error}
        aria-describedby={error ? 'social-help social-error' : 'social-help'}
        onChange={(e) => onChange(e.target.value)}
        className={textareaCls(!!error)}
      />
      <p id="social-help" className={helpCls}>
        A descrição poderá ser atualizada pela equipe autorizada.
      </p>
      {error && (
        <p id="social-error" className={fieldErrorCls}>
          {error}
        </p>
      )}
    </div>
  );
}
