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
  hasHouse?: boolean;
};

type AuthSessionApiResponse = {
  session: SessionData;
};

const AUTH_CHANGED_EVENT = "smart-perumahan-auth-changed";
const AUTH_SESSION_UPDATED_EVENT = "smart-perumahan-auth-session-updated";
const WARGA_DATA_UPDATED_EVENT = "smart-perumahan-warga-data-updated";

let cachedSession: SessionData | null = null;
let cachedSessionLoading = false;
let hasLoadedCachedSession = false;
let inFlightSessionRequest: Promise<void> | null = null;

type WargaDatasetCache = {
  users: UserRow[];
  houses: HouseRow[];
  bills: BillRow[];
  transactions: TransactionRow[];
};

const EMPTY_WARGA_DATASET: WargaDatasetCache = {
  users: [],
  houses: [],
  bills: [],
  transactions: [],
};

let cachedWargaDataset: WargaDatasetCache = EMPTY_WARGA_DATASET;
let cachedWargaDatasetLoading = false;
let hasLoadedWargaDataset = false;
let inFlightWargaDatasetRequest: Promise<void> | null = null;

function emitAuthSessionUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_UPDATED_EVENT));
}

function emitAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function emitWargaDataUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WARGA_DATA_UPDATED_EVENT));
}

function resetWargaDataCache() {
  cachedWargaDataset = EMPTY_WARGA_DATASET;
  cachedWargaDatasetLoading = false;
  hasLoadedWargaDataset = false;
  inFlightWargaDatasetRequest = null;
  emitWargaDataUpdated();
}

async function syncWargaDataCache(force = false) {
  if (!force && hasLoadedWargaDataset) {
    return;
  }

  if (inFlightWargaDatasetRequest) {
    await inFlightWargaDatasetRequest;
    return;
  }

  cachedWargaDatasetLoading = true;
  emitWargaDataUpdated();

  const request = (async () => {
    try {
      // Keep sequential requests to reduce burst load on pooled DB connections.
      const usersRows = await apiClient.getUsers().catch(() => null);
      if (usersRows) {
        cachedWargaDataset = { ...cachedWargaDataset, users: usersRows };
      }

      const housesRows = await apiClient.getHouses().catch(() => null);
      if (housesRows) {
        cachedWargaDataset = { ...cachedWargaDataset, houses: housesRows };
      }

      const billsRows = await apiClient.getBills().catch(() => null);
      if (billsRows) {
        cachedWargaDataset = { ...cachedWargaDataset, bills: billsRows };
      }

      const transactionRows = await apiClient.getTransactions().catch(() => null);
      if (transactionRows) {
        cachedWargaDataset = { ...cachedWargaDataset, transactions: transactionRows };
      }
    } finally {
      // Mark as loaded even when API partially fails so route transitions aren't blocked by endless loaders.
      hasLoadedWargaDataset = true;
      cachedWargaDatasetLoading = false;
    }
  })();

  inFlightWargaDatasetRequest = request;
  try {
    await request;
  } finally {
    if (inFlightWargaDatasetRequest === request) {
      inFlightWargaDatasetRequest = null;
    }
    emitWargaDataUpdated();
  }
}

async function syncSessionCache(force = false) {
  if (!force && hasLoadedCachedSession) {
    return;
  }

  if (inFlightSessionRequest) {
    await inFlightSessionRequest;
    return;
  }

  cachedSessionLoading = true;
  emitAuthSessionUpdated();

  const request = (async () => {
    try {
      const response = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
      if (response.status === 401) {
        cachedSession = null;
        return;
      }

      const body = (await response.json().catch(() => null)) as AuthSessionApiResponse | { message?: string } | null;
      if (!response.ok || !body || !("session" in body) || !body.session) {
        cachedSession = null;
        return;
      }

      cachedSession = body.session;
    } catch {
      cachedSession = null;
    } finally {
      hasLoadedCachedSession = true;
      cachedSessionLoading = false;
    }
  })();

  inFlightSessionRequest = request;
  try {
    await request;
  } finally {
    if (inFlightSessionRequest === request) {
      inFlightSessionRequest = null;
    }
    emitAuthSessionUpdated();
  }
}

export function signInWithGoogle() {
  if (typeof window === "undefined") return;
  window.location.assign("/api/auth/google/start");
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  cachedSession = null;
  hasLoadedCachedSession = true;
  cachedSessionLoading = false;
  resetWargaDataCache();
  emitAuthSessionUpdated();
  emitAuthChanged();
}

export function useAuthSession() {
  const [session, setSession] = useState<SessionData | null>(() => (hasLoadedCachedSession ? cachedSession : null));
  const [loading, setLoading] = useState<boolean>(() => (hasLoadedCachedSession ? cachedSessionLoading : true));

  const syncHookStateFromCache = useCallback(() => {
    setSession(cachedSession);
    setLoading(hasLoadedCachedSession ? cachedSessionLoading : true);
  }, []);

  useEffect(() => {
    function onSessionUpdated() {
      syncHookStateFromCache();
    }

    function onAuthChanged() {
      void syncSessionCache(true);
    }

    syncHookStateFromCache();
    if (!hasLoadedCachedSession) {
      void syncSessionCache(false);
    }

    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated);
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [syncHookStateFromCache]);

  return {
    loading,
    session,
    authUser: session ? { id: session.userId, email: session.email } : null,
    refetch: () => syncSessionCache(true),
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
  const [usersData, setUsersData] = useState<UserRow[]>(() => cachedWargaDataset.users);
  const [housesData, setHousesData] = useState<HouseRow[]>(() => cachedWargaDataset.houses);
  const [billsData, setBillsData] = useState<BillRow[]>(() => cachedWargaDataset.bills);
  const [transactionsData, setTransactionsData] = useState<TransactionRow[]>(() => cachedWargaDataset.transactions);
  const [dataLoading, setDataLoading] = useState<boolean>(() => {
    if (loading) return true;
    if (!session) return false;
    return !hasLoadedWargaDataset;
  });

  const syncHookStateFromWargaCache = useCallback(() => {
    setUsersData(cachedWargaDataset.users);
    setHousesData(cachedWargaDataset.houses);
    setBillsData(cachedWargaDataset.bills);
    setTransactionsData(cachedWargaDataset.transactions);

    if (loading) {
      setDataLoading(true);
      return;
    }
    if (!session) {
      setDataLoading(false);
      return;
    }
    setDataLoading(!hasLoadedWargaDataset);
  }, [loading, session]);

  const loadAllData = useCallback(
    async (force = false) => {
      if (loading) return;
      if (!session) {
        resetWargaDataCache();
        return;
      }
      await syncWargaDataCache(force);
    },
    [loading, session]
  );

  useEffect(() => {
    function onWargaDataUpdated() {
      syncHookStateFromWargaCache();
    }

    syncHookStateFromWargaCache();
    if (!loading && session && !hasLoadedWargaDataset) {
      void syncWargaDataCache(false);
    }

    window.addEventListener(WARGA_DATA_UPDATED_EVENT, onWargaDataUpdated);
    return () => window.removeEventListener(WARGA_DATA_UPDATED_EVENT, onWargaDataUpdated);
  }, [loading, session, syncHookStateFromWargaCache]);

  useEffect(() => {
    if (loading) return;
    if (!session) return;

    function onDataChanged() {
      void syncWargaDataCache(true);
    }

    window.addEventListener("smart-perumahan-data-changed", onDataChanged);
    return () => window.removeEventListener("smart-perumahan-data-changed", onDataChanged);
  }, [loading, session]);

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

  return {
    loading: loading || dataLoading,
    session,
    refresh: () => loadAllData(true),
    ...data,
  };
}
