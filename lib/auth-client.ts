"use client";

import { createAuthClient } from "better-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "@/lib/api-client";
import {
  BillRow,
  HouseRow,
  TransactionRow,
  UserRow,
} from "@/lib/mock-data";

export const authClient = createAuthClient({
  basePath: "/api/auth",
});

export type SessionRole = "admin" | "warga" | "finance";

export type SessionData = {
  email: string;
  role: SessionRole;
  name: string;
  userId: string;
};

type AuthFlowInput = {
  email: string;
  password: string;
  name: string;
};

type AuthFlowResult = {
  ok: boolean;
  message?: string;
};

export async function signInOrBootstrap({ email, password, name }: AuthFlowInput): Promise<AuthFlowResult> {
  const signInResult = await authClient.signIn.email({
    email,
    password,
    rememberMe: true,
  });

  if (!signInResult.error) return { ok: true };

  const signUpResult = await authClient.signUp.email({
    email,
    password,
    name,
  });

  if (!signUpResult.error) return { ok: true };

  const signInMessage = signInResult.error.message?.toLowerCase() ?? "";
  const signUpMessage = signUpResult.error.message?.toLowerCase() ?? "";

  if (signInMessage.includes("invalid email or password") && signUpMessage.includes("already exists")) {
    return { ok: false, message: "Password salah untuk email ini." };
  }

  return {
    ok: false,
    message: signInResult.error.message ?? signUpResult.error.message ?? "Gagal login.",
  };
}

export async function logout() {
  await authClient.signOut();
}

export function useAuthSession() {
  const sessionQuery = authClient.useSession();
  const [usersData, setUsersData] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const rows = await apiClient.getUsers();
      setUsersData(rows);
    } catch {
      setUsersData([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    window.addEventListener("smart-perumahan-data-changed", loadUsers);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadUsers);
  }, [loadUsers]);

  const session = useMemo<SessionData | null>(() => {
    const authUser = sessionQuery.data?.user;
    if (!authUser?.email) return null;
    const normalizedEmail = authUser.email.toLowerCase();
    const matchedUser = usersData.find((item) => item.email.toLowerCase() === normalizedEmail);
    if (!matchedUser) return null;

    return {
      email: matchedUser.email,
      role: matchedUser.role,
      name: matchedUser.name,
      userId: authUser.id,
    };
  }, [sessionQuery.data?.user, usersData]);

  return {
    loading: sessionQuery.isPending || usersLoading,
    session,
    authUser: sessionQuery.data?.user ?? null,
    refetch: sessionQuery.refetch,
    refreshUsers: loadUsers,
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

      if (usersRows.status === "fulfilled") {
        setUsersData(usersRows.value);
      } else {
        setUsersData((prev) => (prev.length ? prev : []));
      }

      if (housesRows.status === "fulfilled") {
        setHousesData(housesRows.value);
      } else {
        setHousesData((prev) => (prev.length ? prev : []));
      }

      if (billsRows.status === "fulfilled") {
        setBillsData(billsRows.value);
      } else {
        setBillsData((prev) => (prev.length ? prev : []));
      }

      if (transactionRows.status === "fulfilled") {
        setTransactionsData(transactionRows.value);
      } else {
        setTransactionsData((prev) => (prev.length ? prev : []));
      }
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
    loadAllData();
    window.addEventListener("smart-perumahan-data-changed", loadAllData);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadAllData);
  }, [loadAllData]);

  const data = useMemo<WargaResolvedData>(() => {
    if (!session?.email) {
      return {
        user: null,
        house: null,
        linkedUsers: [],
        houseBills: [],
        houseTransactions: [],
      };
    }

    const email = session.email.toLowerCase();
    const user = usersData.find((item) => item.email.toLowerCase() === email && item.role === "warga") ?? null;
    const house =
      housesData.find((item) => item.linked_emails.map((mail) => mail.toLowerCase()).includes(email)) ?? null;

    const houseBills = house ? billsData.filter((item) => item.house_id === house.id) : [];
    const houseBillIds = new Set(houseBills.map((item) => item.id));
    const houseTransactions = transactionsData.filter((item) => (item.bill_id ? houseBillIds.has(item.bill_id) : false));
    const linkedUsers = house
      ? usersData.filter((item) =>
          house.linked_emails.map((mail) => mail.toLowerCase()).includes(item.email.toLowerCase())
        )
      : [];

    return {
      user,
      house,
      linkedUsers,
      houseBills,
      houseTransactions,
    };
  }, [billsData, housesData, session?.email, transactionsData, usersData]);

  return { loading: loading || dataLoading, session, refresh: loadAllData, ...data };
}
