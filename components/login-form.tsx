"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { signInWithGoogle, useAuthSession } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const { loading: sessionLoading, session } = useAuthSession();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session?.role) return;
    if (session.role === "finance") {
      router.replace("/dashboard/admin");
      return;
    }
    if (session.role === "admin") {
      router.replace("/dashboard/admin");
      return;
    }
    router.replace("/dashboard/warga");
  }, [router, session?.role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const oauthError = new URLSearchParams(window.location.search).get("error")?.toLowerCase();
    if (!oauthError) return;

    if (oauthError.includes("email_not_registered")) {
      setError("Email Google anda belum terdaftar di sistem kami. Hubungi administrator segera.");
      return;
    }
    if (oauthError.includes("google_config_missing")) {
      setError("Konfigurasi Google OAuth belum lengkap pada server.");
      return;
    }
    if (oauthError.includes("google_oauth_failed")) {
      setError("Login Google gagal diproses. Silakan coba lagi.");
      return;
    }
    if (oauthError.includes("redirect_uri_mismatch")) {
      setError("Konfigurasi Google OAuth belum sesuai (redirect URI mismatch).");
      return;
    }
    setError("Login Google gagal. Silakan coba lagi.");
  }, []);

  function onGoogleLogin() {
    setSubmitting(true);
    setError("");
    setInfo("Mengalihkan ke Google...");
    signInWithGoogle();
  }

  return (
    <div className="space-y-4">
      <FormErrorAlert message={error} />
      <Button type="button" className="w-full" disabled={submitting || sessionLoading} onClick={onGoogleLogin}>
        <LogIn className="mr-2 h-4 w-4" />
        {submitting ? "Memproses..." : "Login dengan Google"}
      </Button>
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
      <p className="text-xs text-muted-foreground">
        Setelah login Google berhasil, sistem akan cek email ke tabel user.
      </p>
    </div>
  );
}
