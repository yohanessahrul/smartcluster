"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { RoleBadge } from "@/components/ui/role-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { apiClient, emitDataChanged } from "@/lib/api-client";
import type { HouseRow, UserRow } from "@/lib/mock-data";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

type WargaProfileData = {
  session: { email: string; role: "admin" | "superadmin" | "warga" | "finance"; name: string; userId: string } | null;
  house: HouseRow | null;
  linkedUsers: UserRow[];
  refresh: () => Promise<void>;
};

function getNextUserId(rows: UserRow[]) {
  const max = rows.reduce((acc, row) => {
    const match = /^U(\d+)$/.exec(row.id);
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return `U${String(max + 1).padStart(3, "0")}`;
}

function WargaProfileContent({ data }: { data: WargaProfileData }) {
  const actorEmail = data.session?.email.toLowerCase() ?? "";
  const houseLinkedEmails = data.house?.linked_emails ?? [];
  const primaryEmail = (houseLinkedEmails[0] ?? "").toLowerCase();
  const secondaryEmail = (houseLinkedEmails[1] ?? "").toLowerCase();
  const hasSecondaryEmail = Boolean(secondaryEmail);
  const isPrimaryUser = Boolean(actorEmail && primaryEmail && actorEmail === primaryEmail);

  const secondaryUser = useMemo(() => {
    if (!secondaryEmail) return null;
    return data.linkedUsers.find((item) => item.email.toLowerCase() === secondaryEmail) ?? null;
  }, [data.linkedUsers, secondaryEmail]);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  useEffect(() => {
    setFormName(secondaryUser?.name ?? "");
    setFormEmail(secondaryUser?.email ?? secondaryEmail);
    setFormPhone(secondaryUser?.phone ?? "");
  }, [secondaryEmail, secondaryUser]);

  async function upsertSecondaryUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.session || !data.house) return;
    if (!isPrimaryUser) {
      setFormError("Hanya Primary yang bisa mengubah data Secondary.");
      return;
    }

    const name = formName.trim();
    const email = formEmail.trim().toLowerCase();
    const phone = formPhone.trim();

    if (!name || !email || !phone) {
      setFormError("Nama, email, dan nomor telepon wajib diisi.");
      return;
    }
    if (email === primaryEmail) {
      setFormError("Email Secondary tidak boleh sama dengan Primary.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const users = await apiClient.getUsers();
      const emailOwner = users.find((item) => item.email.toLowerCase() === email);

      if (secondaryUser) {
        if (emailOwner && emailOwner.id !== secondaryUser.id) {
          setFormError("Email sudah digunakan user lain. Gunakan email lain.");
          setSubmitting(false);
          return;
        }
        await apiClient.updateUser(
          secondaryUser.id,
          {
            name,
            email,
            phone,
            role: "warga",
          },
          { actorEmail: data.session.email }
        );
      } else {
        if (emailOwner) {
          setFormError("Email sudah digunakan user lain. Gunakan email lain.");
          setSubmitting(false);
          return;
        }
        await apiClient.createUser(
          {
            id: getNextUserId(users),
            name,
            email,
            phone,
            role: "warga",
          },
          { actorEmail: data.session.email }
        );
      }

      await apiClient.updateHouse(
        data.house.id,
        {
          blok: data.house.blok,
          nomor: data.house.nomor,
          residential_status: data.house.residential_status,
          isOccupied: data.house.isOccupied,
          primary_email: primaryEmail,
          secondary_email: email,
          linked_emails: [primaryEmail, email],
        },
        { actorEmail: data.session.email }
      );

      emitDataChanged();
      await data.refresh();
      setUpdateOpen(false);
      setFormError("");
      setSuccessToast("Data Secondary berhasil disimpan.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal menyimpan data Secondary.";
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <DashboardHeader title="Profil House" description="Profile house otomatis berdasarkan email yang login." />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informasi House</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">ID:</span> {data.house?.id}
            </p>
            <p>
              <span className="text-muted-foreground">Unit:</span> {data.house ? `${data.house.blok}-${data.house.nomor}` : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Email Login:</span> {data.session?.email}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Akun Terhubung ke House</CardTitle>
            {isPrimaryUser && hasSecondaryEmail ? (
              <Button
                type="button"
                onClick={() => {
                  setFormError("");
                  setUpdateOpen(true);
                }}
              >
                Update
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {data.linkedUsers.map((user) => (
              <div key={user.id} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-medium">{user.name}</p>
                  <RoleBadge role={user.role} />
                  {user.email.toLowerCase() === primaryEmail ? <Badge variant="success">Primary</Badge> : null}
                  {user.email.toLowerCase() === secondaryEmail ? <Badge variant="secondary">Secondary</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-sm text-muted-foreground">{user.phone}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

      <SimpleModal open={updateOpen} onClose={() => setUpdateOpen(false)} title="Update Secondary">
        <form className="space-y-3" onSubmit={upsertSecondaryUser}>
          <FormErrorAlert message={formError} />
          <div>
            <label className={labelClass}>Nama</label>
            <input
              className={inputClass}
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder="Nama Secondary"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={formEmail}
              onChange={(event) => setFormEmail(event.target.value.toLowerCase())}
              placeholder="secondary@mail.com"
              required
            />
          </div>
          <div>
            <label className={labelClass}>No. Telepon</label>
            <input
              className={inputClass}
              value={formPhone}
              onChange={(event) => setFormPhone(event.target.value)}
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>
          <Button type="submit" loading={submitting} loadingText="Menyimpan..." disabled={submitting}>
            Update
          </Button>
        </form>
      </SimpleModal>
    </div>
  );
}

export default function WargaProfilePage() {
  return (
    <WargaAccessGuard>
      {(data) => <WargaProfileContent data={data} />}
    </WargaAccessGuard>
  );
}
