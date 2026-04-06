import { listBills, listHouses, listTransactions, listUsers } from "@/lib/server/smart-api";
import { BillRow, HouseRow, TransactionRow, UserRow } from "@/lib/mock-data";

export type WargaScopedData = {
  user: UserRow | null;
  house: HouseRow | null;
  linkedUsers: UserRow[];
  houseBills: BillRow[];
  houseTransactions: TransactionRow[];
};

export async function getWargaScopedDataByEmail(emailValue: string): Promise<WargaScopedData> {
  const email = emailValue.trim().toLowerCase();

  const [users, houses, bills, transactions] = await Promise.all([
    listUsers(),
    listHouses(),
    listBills(),
    listTransactions(),
  ]);

  const house = houses.find((item) => item.linked_emails.map((value) => value.toLowerCase()).includes(email)) ?? null;
  const user = users.find((item) => item.email.toLowerCase() === email && item.role === "warga") ?? null;
  const linkedEmails = house ? house.linked_emails.map((value) => value.toLowerCase()) : [];
  const linkedUsers = house ? users.filter((item) => linkedEmails.includes(item.email.toLowerCase())) : [];
  const houseBills = house ? bills.filter((item) => item.house_id === house.id) : [];
  const houseBillIds = new Set(houseBills.map((item) => item.id));
  const houseTransactions = transactions.filter((item) => (item.bill_id ? houseBillIds.has(item.bill_id) : false));

  return {
    user,
    house,
    linkedUsers,
    houseBills,
    houseTransactions,
  };
}
