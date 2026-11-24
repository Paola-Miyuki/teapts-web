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

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillForm(
  password: string,
  confirmPassword: string,
  cpf = '52998224725',
) {
  fill('Nome completo', 'Priscila Martins');
  fill('Data de nascimento', '1994-12-01');
  fill('Sexo', 'female');
  fill('CPF', cpf);
  fill('E-mail', 'priscila@example.com');
  fill('Criar senha', password);
  fill('Repita a senha', confirmPassword);
}

describe('SignupPage', () => {
  beforeEach(() => {
    signUp.mockReset();
    render(<SignupPage />);
  });

  it('mostra os campos da conta, com os opcionais marcados', () => {
    expect(screen.getByLabelText('Nome social (opcional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Gênero (opcional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefone (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('pede os campos obrigatórios sem chamar a API', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /Preencha todos os campos obrigatórios/i,
    );
    expect(screen.getByLabelText('CPF')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Criar senha')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('aplica a máscara e recusa CPF com dígito verificador errado', () => {
    fillForm('teapts123', 'teapts123', '52998224724');

    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-24');

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe um CPF válido',
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('avisa quando as senhas não coincidem', () => {
    fillForm('teapts123', 'teapts124');

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'As senhas não coincidem',
    );
    expect(screen.getByLabelText('Repita a senha')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('cria a conta com os dados pessoais e volta para o login', async () => {
    signUp.mockResolvedValue({ status: 'OK' });

    fillForm('teapts123', 'teapts123');
    fill('Telefone (opcional)', '41994445566');

    expect(screen.getByLabelText('Telefone (opcional)')).toHaveValue(
      '(41) 99444-5566',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/login?registered=true'),
    );
    expect(signUp).toHaveBeenCalledWith({
      formFields: [
        { id: 'name', value: 'Priscila Martins' },
        { id: 'socialName', value: '' },
        { id: 'birthDate', value: '1994-12-01' },
        { id: 'sex', value: 'female' },
        { id: 'gender', value: '' },
        { id: 'cpf', value: '52998224725' },
        { id: 'email', value: 'priscila@example.com' },
        { id: 'phone', value: '41994445566' },
        { id: 'password', value: 'teapts123' },
      ],
    });
  });

  it('mostra o erro do backend para CPF já cadastrado', async () => {
    signUp.mockResolvedValue({
      status: 'FIELD_ERROR',
      formFields: [{ id: 'cpf', error: 'Este CPF já está cadastrado' }],
    });

    fillForm('teapts123', 'teapts123');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este CPF já está cadastrado.',
    );
  });
});
