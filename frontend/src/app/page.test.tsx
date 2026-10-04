import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  beforeEach(() => {
    render(<Home />);
  });

  it('shows the product name as the single top-level heading', () => {
    expect(
      screen.getByRole('heading', { level: 1, name: 'TEAPTS' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('describes what the product does', () => {
    expect(
      screen.getByText(/Projetos Terapêuticos Singulares/i),
    ).toBeInTheDocument();
  });

  it('renders the page content inside a main landmark', () => {
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
