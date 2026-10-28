import Icon from '@/components/Icon';
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
      {!loading && <Icon name="arrow" className="h-3.5 w-3.5" />}
    </button>
  );
}
