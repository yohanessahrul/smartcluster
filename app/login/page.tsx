import type { Metadata } from "next";

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
          <CardHeader className="space-y-4 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-[hsl(var(--menu-border))]">
                <BrandMark className="h-11 w-11" />
              </div>
              <p className="font-heading text-xl">Hunita</p>
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
