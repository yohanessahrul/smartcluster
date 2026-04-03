import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Login",
  description: "Login Hunita untuk akses dashboard perumahan.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="space-y-3 text-center">
            <div className="flex flex-col items-center justify-center pt-[30px] pb-[30px]">
              <Link href="/" className="mb-0 inline-flex h-20 w-20 items-center justify-center p-1" aria-label="Kembali ke landing page">
                <BrandMark className="h-16 w-16" />
              </Link>
              <p className="font-heading text-2xl">Hunita</p>
              <p className="mt-1 text-base text-muted-foreground">Sistem Management Perumahan yang transparan.</p>
            </div>
          </CardHeader>
          <CardContent className="pb-6 pt-2">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
