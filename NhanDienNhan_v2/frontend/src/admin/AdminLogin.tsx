import { useState, type FormEvent } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { authenticateAdmin } from "./auth";

interface AdminLoginProps {
  onAuthenticated: () => void;
}

export function AdminLogin({ onAuthenticated }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authenticateAdmin(username, password)) {
      setError("Tên đăng nhập hoặc mật khẩu không đúng.");
      return;
    }
    setError("");
    onAuthenticated();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900 sm:py-20">
      <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/70">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <LockKeyhole className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold">Quản trị lịch sử OCR</h1>
          <p className="mt-2 text-sm text-slate-500">
            Đăng nhập để xem và quản lý dữ liệu archive.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Tên đăng nhập
            <input
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu
            <input
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            type="submit"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Đăng nhập
          </button>
        </form>
      </section>
    </main>
  );
}
