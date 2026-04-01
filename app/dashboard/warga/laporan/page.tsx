"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah, parseRupiahToNumber } from "@/lib/currency";
import { formatDateTimeUnified } from "@/lib/date-time";
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

  return (
    <WargaAccessGuard>
      {(data) => (
        <div>
          <DashboardHeader
            title="Laporan Penggunaan Dana"
            description={`Transparansi dana untuk house ${data.house?.id} berdasarkan data pada table transaction.`}
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
              <Badge variant="outline">{loadingTransactions ? "Loading..." : `${journalRows.length} baris jurnal`}</Badge>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Kredit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTransactions ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Memuat data transaksi...
                      </TableCell>
                    </TableRow>
                  ) : journalRows.length ? (
                    <>
                      {journalRows.map((row) => {
                        const isIncome = row.transactionType === "Pemasukan";
                        return (
                          <TableRow key={row.key}>
                            <TableCell>{row.ref}</TableCell>
                            <TableCell>
                              <Badge variant={isIncome ? "success" : "warning"}>
                                {isIncome ? "Pemasukan" : "Pengeluaran"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.isPopulated ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedPopulatePeriod(row.populatedPeriod ?? null)}
                                >
                                  {`${row.description} · ${row.populatedCount ?? 0} transaksi`}
                                </Button>
                              ) : (
                                row.description
                              )}
                            </TableCell>
                            <TableCell>{row.debit > 0 ? formatRupiah(row.debit) : "-"}</TableCell>
                            <TableCell>{row.credit > 0 ? formatRupiah(row.credit) : "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell className="font-semibold text-muted-foreground">TOTAL</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="font-semibold">{formatRupiah(totalIncome)}</TableCell>
                        <TableCell className="font-semibold">{formatRupiah(totalExpense)}</TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No record available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {transactionError ? <p className="mt-3 text-sm text-destructive">{transactionError}</p> : null}
            </CardContent>
          </Card>

          <SimpleModal
            open={Boolean(selectedPopulateGroup)}
            onClose={() => setSelectedPopulatePeriod(null)}
            title={`Detail Populate: Pembayaran IPL Warga (${selectedPopulateGroup?.period ?? "-"})`}
            className="w-[96vw] max-w-5xl"
          >
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Nama Transaksi</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPopulateGroup?.rows.length ? (
                  selectedPopulateGroup.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDateTimeUnified(item.date)}</TableCell>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.transaction_type}</TableCell>
                      <TableCell>{item.transaction_name}</TableCell>
                      <TableCell>{formatRupiah(parseRupiahToNumber(item.amount))}</TableCell>
                      <TableCell>{item.payment_method}</TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No record available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SimpleModal>
        </div>
      )}
    </WargaAccessGuard>
  );
}
