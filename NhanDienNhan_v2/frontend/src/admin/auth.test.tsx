import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../App", () => ({ default: () => null }));

import { AppRouter } from "../router";
import { AdminLogin } from "./AdminLogin";
import { authenticateAdmin, isAdminAuthenticated, logoutAdmin } from "./auth";

describe("admin authentication", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubEnv("VITE_ADMIN_USERNAME", "test-admin");
    vi.stubEnv("VITE_ADMIN_PASSWORD", "test-password");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("only creates a tab session with the configured admin credential", () => {
    expect(authenticateAdmin("test-admin", "wrong-password")).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);

    expect(authenticateAdmin("test-admin", "test-password")).toBe(true);
    expect(isAdminAuthenticated()).toBe(true);

    logoutAdmin();
    expect(isAdminAuthenticated()).toBe(false);
  });

  it("shows a generic error when the login form is invalid", () => {
    const onAuthenticated = vi.fn();
    render(<AdminLogin onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), {
      target: { value: "test-admin" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "not-it" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tên đăng nhập hoặc mật khẩu không đúng.",
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("renders the admin login at /admin and opens the dashboard after login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { items: [], total: 0, page: 1, page_size: 20 },
        }),
      }),
    );
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRouter />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), {
      target: { value: "test-admin" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("heading", { name: "Lịch sử OCR" })).toBeVisible();
    expect(isAdminAuthenticated()).toBe(true);
  });
});
