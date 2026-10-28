import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import SignupPage from './page';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/supertokens', () => ({
  initSuperTokens: jest.fn(),
}));

jest.mock('supertokens-web-js/recipe/emailpassword', () => ({
  __esModule: true,
  default: { signUp: jest.fn() },
}));

const signUp = EmailPassword.signUp as jest.Mock;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillForm(password: string, confirmPassword: string) {
  fill('Nome completo', 'Priscila Martins');
  fill('E-mail', 'priscila@example.com');
  fill('Criar senha', password);
  fill('Repita a senha', confirmPassword);
}

describe('SignupPage', () => {
  beforeEach(() => {
    render(<SignupPage />);
  });

  it('pede os campos obrigatórios sem chamar a API', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /Preencha todos os campos obrigatórios/i,
    );
    expect(screen.getByLabelText('Criar senha')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('avisa quando as senhas não coincidem', () => {
    fillForm('teapts123', 'teapts124');

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'As senhas não coincidem.',
    );
    expect(screen.getByLabelText('Repita a senha')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('cria a conta e volta para o login', async () => {
    signUp.mockResolvedValue({ status: 'OK' });

    fillForm('teapts123', 'teapts123');

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/login?registered=true'),
    );
    expect(signUp).toHaveBeenCalledWith({
      formFields: [
        { id: 'name', value: 'Priscila Martins' },
        { id: 'email', value: 'priscila@example.com' },
        { id: 'password', value: 'teapts123' },
      ],
    });
  });
});
