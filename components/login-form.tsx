"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { authClient, signInOrBootstrap } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import { UserRow, users as defaultUsers } from "@/lib/mock-data";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      const rows = await apiClient.getUsers();
      setUsers(rows);
      setMessage("");
    } catch (error) {
      setUsers(defaultUsers);
      setMessage("Backend API tidak terhubung. Menggunakan data demo lokal untuk login.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const user = users.find((item) => item.email.toLowerCase() === normalized);

    if (!user) {
      setMessage("Email tidak ditemukan di tabel user.");
      return;
    }

    if (password.trim().length < 8) {
      setMessage("Password minimal 8 karakter.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const result = await signInOrBootstrap({
      email: user.email,
      password,
      name: user.name,
    });

    if (!result.ok) {
      setSubmitting(false);
      setMessage(result.message ?? "Login gagal.");
      return;
    }

    setMessage("Login berhasil.");
    if (user.role === "admin") {
      router.push("/dashboard/admin");
      setSubmitting(false);
      return;
    }
    if (user.role === "finance") {
      router.push("/dashboard/admin");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard/warga/profile");
    setSubmitting(false);
  }

  async function onSubmitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = resetEmail.trim().toLowerCase();
    const user = users.find((item) => item.email.toLowerCase() === normalized);

    if (!user) {
      setResetMessage("Email tidak ditemukan di tabel user.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setResetMessage("Password baru minimal 8 karakter.");
      return;
    }

    setResetSubmitting(true);
    setResetMessage("");

    const requestResult = await authClient.requestPasswordReset({
      email: user.email,
      redirectTo: `${window.location.origin}/login`,
    });

    if (requestResult.error) {
      setResetSubmitting(false);
      setResetMessage(requestResult.error.message ?? "Gagal membuat token reset.");
      return;
    }

    const tokenResponse = await fetch(`/api/dev/reset-token?email=${encodeURIComponent(user.email)}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      setResetSubmitting(false);
      setResetMessage("Token reset belum tersedia, coba lagi.");
      return;
    }

    const tokenPayload = (await tokenResponse.json()) as { token?: string };

    if (!tokenPayload.token) {
      setResetSubmitting(false);
      setResetMessage("Token reset tidak valid.");
      return;
    }

    const resetResult = await authClient.resetPassword({
      token: tokenPayload.token,
      newPassword,
    });

    if (resetResult.error) {
      setResetSubmitting(false);
      setResetMessage(resetResult.error.message ?? "Reset password gagal.");
      return;
    }

    await fetch(`/api/dev/reset-token?email=${encodeURIComponent(user.email)}`, {
      method: "DELETE",
      cache: "no-store",
    });

    setEmail(user.email);
    setPassword(newPassword);
    setResetMessage("Password berhasil direset. Silakan login dengan password baru.");
    setResetSubmitting(false);
  }

  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="budi.a12@mail.com"
            required
            list="user-email-list"
          />
          <datalist id="user-email-list">
            {users.map((item) => (
              <option key={item.id} value={item.email} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting || loadingUsers}>
          {submitting ? "Memproses..." : "Login"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm text-muted-foreground"
          onClick={() => {
            setResetEmail(email);
            setResetMessage("");
            setResetOpen(true);
          }}
        >
          Lupa Password? Reset
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <p className="text-xs text-muted-foreground">
          Akun Better Auth dibuat otomatis saat login pertama untuk email yang sudah terdaftar di tabel user.
        </p>
      </form>

      <SimpleModal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset Password">
        <form className="space-y-4" onSubmit={onSubmitReset}>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              placeholder="email terdaftar"
              required
              list="user-email-list"
            />
          </div>
          <div>
            <label className={labelClass}>Password Baru</label>
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={resetSubmitting}>
            {resetSubmitting ? "Memproses reset..." : "Reset Password"}
          </Button>
          {resetMessage ? <p className="text-sm text-muted-foreground">{resetMessage}</p> : null}
          <p className="text-xs text-muted-foreground">
            Mode prototype: token reset dibuat internal oleh Better Auth dan digunakan otomatis tanpa email gateway.
          </p>
        </form>
      </SimpleModal>
    </>
  );
}
