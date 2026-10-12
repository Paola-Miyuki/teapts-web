import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import LoginPage from './page';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('@/lib/supertokens', () => ({
  initSuperTokens: jest.fn(),
}));

jest.mock('supertokens-web-js/recipe/emailpassword', () => ({
  __esModule: true,
  default: { signIn: jest.fn() },
}));

const signIn = EmailPassword.signIn as jest.Mock;

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    render(<LoginPage />);
  });

  it('asks for e-mail and password without calling the API', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows a generic message for wrong credentials', async () => {
    signIn.mockResolvedValue({ status: 'WRONG_CREDENTIALS_ERROR' });

    fillAndSubmit('teste@teapts.local', 'senha-errada');

    expect(
      await screen.findByText('E-mail ou senha inválidos.'),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('goes to the home page after a successful sign-in', async () => {
    signIn.mockResolvedValue({ status: 'OK' });

    fillAndSubmit('teste@teapts.local', 'teapts123');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(signIn).toHaveBeenCalledWith({
      formFields: [
        { id: 'email', value: 'teste@teapts.local' },
        { id: 'password', value: 'teapts123' },
      ],
    });
  });
});
