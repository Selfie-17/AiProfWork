import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatusBadge } from "./components/Widgets";
import Login from "./pages/Login";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./components/Toast";

test("status badge renders", () => {
  render(<StatusBadge status="READY" />);
  expect(screen.getByText(/ready/i)).toBeTruthy();
});

test("login form renders", () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Login />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
  expect(screen.getByText("Welcome back")).toBeTruthy();
});
