"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { ApiLoadingState } from "@/components/ui/api-loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { SimpleModal } from "@/components/ui/simple-modal";
import { formatRupiah, parseRupiahToNumber } from "@/lib/currency";
import { apiClient } from "@/lib/api-client";
import { BillRow, TransactionRow } from "@/lib/mock-data";

type JournalRow = {
  key: string;
  ref: string;
  transactionType: TransactionRow["transaction_type"];
  description: string;
  debit: number;
  credit: number;
  isPopulated: boolean;
  populatedPeriod?: string;
  populatedCount?: number;
};

export default function WargaLaporanPage() {
  const textOrDash = (value: string | null | undefined) => {
    const normalized = (value ?? "").trim();
    return normalized || "-";
  };
  const shouldLogTableData = process.env.NODE_ENV !== "production";
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [transactionError, setTransactionError] = useState("");
  const [selectedPopulatePeriod, setSelectedPopulatePeriod] = useState<string | null>(null);

  useEffect(() => {
    void loadTransactions();
    window.addEventListener("smart-perumahan-data-changed", loadTransactions);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadTransactions);
  }, []);

  async function loadTransactions() {
    try {
      setLoadingTransactions(true);
      setTransactionError("");
      const [transactionRows, billRows] = await Promise.all([apiClient.getTransactions(), apiClient.getBills()]);
      setTransactions(transactionRows);
      setBills(billRows);
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : "Gagal memuat data transaksi.");
      setTransactions([]);
      setBills([]);
    } finally {
      setLoadingTransactions(false);
    }
  }

  const paidTransactions = useMemo(() => {
    return transactions.filter((item) => item.status === "Lunas");
  }, [transactions]);

  const billPeriodById = useMemo(() => {
    return new Map(bills.map((bill) => [bill.id, bill.periode]));
  }, [bills]);

  const populatedIplWargaByPeriod = useMemo(() => {
    const grouped = new Map<string, TransactionRow[]>();
    paidTransactions
      .filter((item) => item.transaction_name === "Pembayaran IPL Warga" && item.category === "IPL Warga")
      .forEach((item) => {
        const period = item.bill_id ? billPeriodById.get(item.bill_id) ?? "Tanpa Periode" : "Tanpa Periode";
        const current = grouped.get(period) ?? [];
        current.push(item);
        grouped.set(period, current);
      });

    return Array.from(grouped.entries())
      .map(([period, rows]) => {
        const sortedRows = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const debit = sortedRows
          .filter((item) => item.transaction_type === "Pemasukan")
          .reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0);
        const credit = sortedRows
          .filter((item) => item.transaction_type === "Pengeluaran")
          .reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0);
        const sortTime = sortedRows.length ? new Date(sortedRows[0].date).getTime() : 0;
        return { period, rows: sortedRows, debit, credit, sortTime };
      })
      .sort((a, b) => a.sortTime - b.sortTime);
  }, [billPeriodById, paidTransactions]);

  const populatedIplWargaTransactions = useMemo(() => {
    return populatedIplWargaByPeriod.flatMap((group) => group.rows);
  }, [populatedIplWargaByPeriod]);

  const sortedTransactions = useMemo(() => {
    return [...paidTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [paidTransactions]);

  const journalRows = useMemo<JournalRow[]>(() => {
    const rows: JournalRow[] = [];
    const populatedIds = new Set(populatedIplWargaTransactions.map((item) => item.id));

    if (populatedIplWargaTransactions.length) {
      populatedIplWargaByPeriod.forEach((group, index) => {
        rows.push({
          key: `populated-ipl-warga-${group.period}-${index}`,
          ref: `POP-IPL-WARGA-${String(index + 1).padStart(2, "0")}`,
          transactionType: group.debit >= group.credit ? "Pemasukan" : "Pengeluaran",
          description: `Pembayaran IPL Warga (${group.period})`,
          debit: group.debit,
          credit: group.credit,
          isPopulated: true,
          populatedPeriod: group.period,
          populatedCount: group.rows.length,
        });
      });
    }

    sortedTransactions
      .filter((item) => !populatedIds.has(item.id))
      .forEach((item) => {
        const amount = parseRupiahToNumber(item.amount);
        rows.push({
          key: item.id,
          ref: item.id,
          transactionType: item.transaction_type,
          description: `${item.transaction_name} (${item.category})`,
          debit: item.transaction_type === "Pemasukan" ? amount : 0,
          credit: item.transaction_type === "Pengeluaran" ? amount : 0,
          isPopulated: false,
        });
      });

    return rows;
  }, [populatedIplWargaByPeriod, populatedIplWargaTransactions, sortedTransactions]);

  const selectedPopulateGroup = useMemo(() => {
    if (!selectedPopulatePeriod) return null;
    return populatedIplWargaByPeriod.find((group) => group.period === selectedPopulatePeriod) ?? null;
  }, [populatedIplWargaByPeriod, selectedPopulatePeriod]);

  const totalIncome = useMemo(() => {
    return paidTransactions
      .filter((item) => item.transaction_type === "Pemasukan")
      .reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0);
  }, [paidTransactions]);

  const totalExpense = useMemo(() => {
    return paidTransactions
      .filter((item) => item.transaction_type === "Pengeluaran")
      .reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0);
  }, [paidTransactions]);

  const netBalance = totalIncome - totalExpense;

  useEffect(() => {
    if (!shouldLogTableData) return;
    console.log("[Table][Warga Laporan] transactions:", transactions);
    console.log("[Table][Warga Laporan] ipl:", bills);
    console.log("[Table][Warga Laporan] paidTransactions:", paidTransactions);
    console.log("[Table][Warga Laporan] journalRows:", journalRows);
  }, [shouldLogTableData, transactions, bills, paidTransactions, journalRows]);

  return (
    <WargaAccessGuard>
      {(data) => (
        <div>
          <DashboardHeader
            title="Laporan Penggunaan Dana"
            description={`Transparansi dana untuk rumah ${textOrDash(data.house?.id)} berdasarkan data pada tabel transaksi.`}
          />

          <section className="mb-4 grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Pemasukan</p>
                <p className="font-heading text-xl">{formatRupiah(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                <p className="font-heading text-xl">{formatRupiah(totalExpense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Saldo Bersih Transaksi</p>
                <p className="font-heading text-xl">{formatRupiah(netBalance)}</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Laporan Keuangan (Jurnal Umum)</CardTitle>
              <Badge variant="outline">{loadingTransactions ? "Memuat..." : `${journalRows.length} baris jurnal`}</Badge>
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <ApiLoadingState message="Memuat data transaksi..." />
              ) : journalRows.length ? (
                <div className="space-y-3">
                  {journalRows.map((row) => {
                    const isIncome = row.transactionType === "Pemasukan";
                    return (
                      <div key={row.key} className="rounded-lg border border-border bg-background p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Ref</p>
                            <p className="font-medium">{row.ref}</p>
                          </div>
                          <Badge variant={isIncome ? "success" : "warning"}>
                            {isIncome ? "Pemasukan" : "Pengeluaran"}
                          </Badge>
                        </div>

                        <div className="mt-3 text-sm">
                          {row.isPopulated ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPopulatePeriod(row.populatedPeriod ?? null)}
                            >
                              {`${row.description} · ${row.populatedCount ?? 0} transaksi`}
                            </Button>
                          ) : (
                            <p>{textOrDash(row.description)}</p>
                          )}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <p>
                            <span className="text-muted-foreground">Debit:</span> {row.debit > 0 ? formatRupiah(row.debit) : "-"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Kredit:</span> {row.credit > 0 ? formatRupiah(row.credit) : "-"}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
                    <p className="text-sm font-semibold text-muted-foreground">TOTAL</p>
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-muted-foreground">Debit:</span> <span className="font-semibold">{formatRupiah(totalIncome)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Kredit:</span> <span className="font-semibold">{formatRupiah(totalExpense)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                  No record available
                </div>
              )}
              {transactionError ? <p className="mt-3 text-sm text-destructive">{transactionError}</p> : null}
            </CardContent>
          </Card>

          <SimpleModal
            open={Boolean(selectedPopulateGroup)}
            onClose={() => setSelectedPopulatePeriod(null)}
            title={`Detail Populate: Pembayaran IPL Warga (${selectedPopulateGroup?.period ?? "-"})`}
            className="w-[96vw] max-w-5xl"
          >
            <div className="space-y-3">
              {selectedPopulateGroup?.rows.length ? (
                selectedPopulateGroup.rows.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-background p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">ID</p>
                        <p className="font-medium">{textOrDash(item.id)}</p>
                      </div>
                      <Badge variant={item.transaction_type === "Pemasukan" ? "success" : "warning"}>{item.transaction_type}</Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-muted-foreground">Tanggal:</span> <DateTimeText value={item.date} />
                      </p>
                      <p>
                        <span className="text-muted-foreground">Amount:</span> {formatRupiah(parseRupiahToNumber(item.amount))}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Nama Transaksi:</span> {textOrDash(item.transaction_name)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Payment Method:</span> {textOrDash(item.payment_method)}
                      </p>
                      <p className="sm:col-span-2">
                        <span className="text-muted-foreground">Status:</span> {textOrDash(item.status)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                  No record available
                </div>
              )}
            </div>
          </SimpleModal>
        </div>
      )}
    </WargaAccessGuard>
  );
}
