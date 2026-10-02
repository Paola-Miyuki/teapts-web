import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import LogoutButton from "./LogoutButton";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("exibe o botão Sair quando existe sessão ativa", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 200,
      })
    );

    render(<LogoutButton />);

    expect(
      await screen.findByRole("button", {
        name: "Sair",
      })
    ).toBeInTheDocument();
  });

  it("não exibe o botão quando não existe sessão ativa", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 401,
      })
    );

    render(<LogoutButton />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole("button", {
        name: "Sair",
      })
    ).not.toBeInTheDocument();
  });

  it("envia logout e redireciona para o login", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "OK",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

    render(<LogoutButton />);

    const button = await screen.findByRole(
      "button",
      {
        name: "Sair",
      }
    );

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        "http://localhost:3000/auth/signout",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            allSessions: false,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(
        replaceMock
      ).toHaveBeenCalledWith("/login");
    });

    expect(refreshMock).toHaveBeenCalled();
  });

  it("trata sessão já expirada como logout concluído", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "unauthorised",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

    render(<LogoutButton />);

    const button = await screen.findByRole(
      "button",
      {
        name: "Sair",
      }
    );

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        replaceMock
      ).toHaveBeenCalledWith("/login");
    });
  });

  it("exibe mensagem quando ocorre erro de rede", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        })
      )
      .mockRejectedValueOnce(
        new Error("network error")
      );

    render(<LogoutButton />);

    const button = await screen.findByRole(
      "button",
      {
        name: "Sair",
      }
    );

    fireEvent.click(button);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente."
    );
  });
});