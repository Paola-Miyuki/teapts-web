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
      className={`${primaryBtnCls}`}
    >
      {loading ? 'Criando proposta...' : 'Criar proposta'}
      {!loading && (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
      )}
    </button>
  );
}
