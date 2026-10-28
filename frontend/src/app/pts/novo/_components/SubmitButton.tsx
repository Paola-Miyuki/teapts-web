import { primaryBtnCls } from '../styles';

interface Props {
  loading: boolean;
  disabled?: boolean;
}

export function SubmitButton({ loading, disabled }: Props) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      aria-busy={loading}
      className={primaryBtnCls}
    >
      {loading ? 'Criando proposta...' : 'Criar proposta'}
    </button>
  );
}
