export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "superadmin" | "warga" | "finance";
};

export type HouseRow = {
  id: string;
  blok: string;
  nomor: string;
  residential_status: "Pemilik" | "Ngontrak";
  isOccupied: boolean;
  linked_emails: string[];
};

export type BillRow = {
  id: string;
  house_id: string;
  periode: string;
  amount: string;
  payment_method: "Transfer Bank" | "Cash" | "QRIS" | "E-wallet";
  status: "Lunas" | "Belum bayar" | "Menunggu Verifikasi" | "Verifikasi";
  status_date: string;
  payment_proof_url?: string | null;
  paid_to_developer: boolean;
  date_paid_period_to_developer: string | null;
};

export type TransactionRow = {
  id: string;
  bill_id: string | null;
  transaction_type: "Pemasukan" | "Pengeluaran";
  transaction_name: string;
  category: "IPL Warga" | "IPL Cluster" | "Barang Inventaris" | "Other";
  amount: string;
  date: string;
  payment_method: "Transfer Bank" | "Cash" | "QRIS" | "E-wallet";
  status: "Lunas" | "Belum bayar" | "Verifikasi" | "Menunggu Verifikasi";
  status_date: string;
};

export const users: UserRow[] = [
  {
    id: "U001",
    name: "Yohanes Sahrul",
    email: "yohanessahrul92@gmail.com",
    phone: "081703631403",
    role: "admin",
  },
  {
    id: "U002",
    name: "Budi Santoso",
    email: "budi.a12@mail.com",
    phone: "08123456789",
    role: "warga",
  },
  {
    id: "U003",
    name: "Sri Wulandari",
    email: "sri.b03@mail.com",
    phone: "081390008877",
    role: "warga",
  },
  {
    id: "U004",
    name: "Agus Pratama",
    email: "agus.c21@mail.com",
    phone: "081398887766",
    role: "warga",
  },
  {
    id: "U005",
    name: "Nadia Putri",
    email: "nadia.a07@mail.com",
    phone: "081222334455",
    role: "warga",
  },
  {
    id: "U006",
    name: "Sari Santoso",
    email: "sari.a12@mail.com",
    phone: "081277788899",
    role: "warga",
  },
  {
    id: "U007",
    name: "Finance Cluster",
    email: "finance@smartperumahan.id",
    phone: "081299900011",
    role: "finance",
  },
];

export const houses: HouseRow[] = [
  {
    id: "H001",
    blok: "A",
    nomor: "12",
    residential_status: "Pemilik",
    isOccupied: true,
    linked_emails: ["budi.a12@mail.com", "sari.a12@mail.com"],
  },
  { id: "H002", blok: "B", nomor: "03", residential_status: "Ngontrak", isOccupied: true, linked_emails: ["sri.b03@mail.com"] },
  { id: "H003", blok: "C", nomor: "21", residential_status: "Pemilik", isOccupied: false, linked_emails: ["agus.c21@mail.com"] },
  { id: "H004", blok: "A", nomor: "07", residential_status: "Ngontrak", isOccupied: true, linked_emails: ["nadia.a07@mail.com"] },
];

export const bills: BillRow[] = [
  {
    id: "BILL001",
    house_id: "H001",
    periode: "Maret 2026",
    amount: "Rp150.000",
    payment_method: "Transfer Bank",
    status: "Lunas",
    status_date: "2026-03-08T08:15:00+07:00",
    payment_proof_url: null,
    paid_to_developer: true,
    date_paid_period_to_developer: "2026-03-28",
  },
  {
    id: "BILL002",
    house_id: "H002",
    periode: "Maret 2026",
    amount: "Rp150.000",
    payment_method: "Transfer Bank",
    status: "Belum bayar",
    status_date: "2026-03-01T09:00:00+07:00",
    payment_proof_url: null,
    paid_to_developer: false,
    date_paid_period_to_developer: null,
  },
  {
    id: "BILL003",
    house_id: "H003",
    periode: "Maret 2026",
    amount: "Rp150.000",
    payment_method: "QRIS",
    status: "Verifikasi",
    status_date: "2026-03-10T10:20:00+07:00",
    payment_proof_url: null,
    paid_to_developer: false,
    date_paid_period_to_developer: null,
  },
  {
    id: "BILL004",
    house_id: "H004",
    periode: "Maret 2026",
    amount: "Rp150.000",
    payment_method: "Cash",
    status: "Lunas",
    status_date: "2026-03-09T11:40:00+07:00",
    payment_proof_url: null,
    paid_to_developer: true,
    date_paid_period_to_developer: "2026-03-29",
  },
];

export const transactions: TransactionRow[] = [
  {
    id: "TRX001",
    bill_id: "BILL001",
    transaction_type: "Pemasukan",
    transaction_name: "Pembayaran IPL Warga",
    category: "IPL Warga",
    amount: "Rp150.000",
    date: "2026-03-08T08:15:00+07:00",
    payment_method: "Transfer Bank",
    status: "Lunas",
    status_date: "2026-03-08T08:15:00+07:00",
  },
  {
    id: "TRX002",
    bill_id: "BILL004",
    transaction_type: "Pemasukan",
    transaction_name: "Pembayaran IPL Warga",
    category: "IPL Warga",
    amount: "Rp150.000",
    date: "2026-03-09T12:30:00+07:00",
    payment_method: "QRIS",
    status: "Verifikasi",
    status_date: "2026-03-09T12:30:00+07:00",
  },
  {
    id: "TRX003",
    bill_id: null,
    transaction_type: "Pengeluaran",
    transaction_name: "Transfer IPL ke Cluster",
    category: "IPL Cluster",
    amount: "Rp500.000",
    date: "2026-03-10T14:45:00+07:00",
    payment_method: "Transfer Bank",
    status: "Lunas",
    status_date: "2026-03-10T14:45:00+07:00",
  },
];
