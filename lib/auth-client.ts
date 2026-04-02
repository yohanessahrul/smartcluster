"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { BillRow, HouseRow, TransactionRow, UserRow } from "@/lib/mock-data";

export type SessionRole = "admin" | "superadmin" | "warga" | "finance";

export type SessionData = {
  email: string;
  role: SessionRole;
  name: string;
  userId: string;
};

type AuthSessionApiResponse = {
  session: SessionData;
};

function emitAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("smart-perumahan-auth-changed"));
}

export function signInWithGoogle() {
  if (typeof window === "undefined") return;
  window.location.assign("/api/auth/google/start");
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  emitAuthChanged();
}

export function useAuthSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });

      if (response.status === 401) {
        setSession(null);
        return;
      }

      const body = (await response.json().catch(() => null)) as AuthSessionApiResponse | { message?: string } | null;
      if (!response.ok || !body || !("session" in body) || !body.session) {
        setSession(null);
        return;
      }

      setSession(body.session);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
    window.addEventListener("smart-perumahan-auth-changed", loadSession);
    return () => window.removeEventListener("smart-perumahan-auth-changed", loadSession);
  }, [loadSession]);

  return {
    loading,
    session,
    authUser: session ? { id: session.userId, email: session.email } : null,
    refetch: loadSession,
    refreshUsers: async () => {},
  };
}

export type WargaResolvedData = {
  user: UserRow | null;
  house: HouseRow | null;
  linkedUsers: UserRow[];
  houseBills: BillRow[];
  houseTransactions: TransactionRow[];
};

export function useWargaResolvedData() {
  const { loading, session } = useAuthSession();
  const [usersData, setUsersData] = useState<UserRow[]>([]);
  const [housesData, setHousesData] = useState<HouseRow[]>([]);
  const [billsData, setBillsData] = useState<BillRow[]>([]);
  const [transactionsData, setTransactionsData] = useState<TransactionRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const loadAllData = useCallback(async () => {
    try {
      setDataLoading(true);
      const [usersRows, housesRows, billsRows, transactionRows] = await Promise.allSettled([
        apiClient.getUsers(),
        apiClient.getHouses(),
        apiClient.getBills(),
        apiClient.getTransactions(),
      ]);

      if (usersRows.status === "fulfilled") setUsersData(usersRows.value);
      else setUsersData((prev) => (prev.length ? prev : []));

      if (housesRows.status === "fulfilled") setHousesData(housesRows.value);
      else setHousesData((prev) => (prev.length ? prev : []));

      if (billsRows.status === "fulfilled") setBillsData(billsRows.value);
      else setBillsData((prev) => (prev.length ? prev : []));

      if (transactionRows.status === "fulfilled") setTransactionsData(transactionRows.value);
      else setTransactionsData((prev) => (prev.length ? prev : []));
    } catch {
      setUsersData((prev) => (prev.length ? prev : []));
      setHousesData((prev) => (prev.length ? prev : []));
      setBillsData((prev) => (prev.length ? prev : []));
      setTransactionsData((prev) => (prev.length ? prev : []));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
    window.addEventListener("smart-perumahan-data-changed", loadAllData);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadAllData);
  }, [loadAllData]);

  const data = useMemo<WargaResolvedData>(() => {
    if (!session?.email) {
      return { user: null, house: null, linkedUsers: [], houseBills: [], houseTransactions: [] };
    }

    const email = session.email.toLowerCase();
    const user = usersData.find((item) => item.email.toLowerCase() === email && item.role === "warga") ?? null;
    const house =
      housesData.find((item) => item.linked_emails.map((mail) => mail.toLowerCase()).includes(email)) ?? null;

    const houseBills = house ? billsData.filter((item) => item.house_id === house.id) : [];
    const houseBillIds = new Set(houseBills.map((item) => item.id));
    const houseTransactions = transactionsData.filter((item) => (item.bill_id ? houseBillIds.has(item.bill_id) : false));
    const linkedUsers = house
      ? usersData.filter((item) => house.linked_emails.map((mail) => mail.toLowerCase()).includes(item.email.toLowerCase()))
      : [];

    return { user, house, linkedUsers, houseBills, houseTransactions };
  }, [billsData, housesData, session?.email, transactionsData, usersData]);

  return { loading: loading || dataLoading, session, refresh: loadAllData, ...data };
}
