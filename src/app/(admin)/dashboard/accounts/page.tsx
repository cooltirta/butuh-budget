"use client";
import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number; // in cents
};

type Category = {
  id: string;
  name: string;
  categoryGroup: {
    name: string;
  };
};

type Transaction = {
  id: string;
  date: string;
  payee: string;
  memo: string | null;
  amount: number; // in cents
  cleared: boolean;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  account: Account;
  toAccount: Account | null;
  category: Category | null;
};

function AccountsRegister() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeAccountId = searchParams.get("id"); // Can be null (meaning "All Accounts")

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txType, setTxType] = useState<"standard" | "transfer">("standard");
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    payee: "",
    accountId: "",
    toAccountId: "",
    categoryId: "",
    memo: "",
    amountStr: "",
    isOutflow: true, // true for expense, false for income
    cleared: true,
  });

  const [txLoading, setTxLoading] = useState(false);

  // Fetch all categories (grouped or flat)
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/budget?month=" + new Date().toISOString().split("T")[0].substring(0, 7) + "-01");
      if (res.ok) {
        const json = await res.json();
        const flatCats: Category[] = [];
        json.categoryGroups.forEach((g: any) => {
          g.categories.forEach((c: any) => {
            flatCats.push({
              id: c.id,
              name: c.name,
              categoryGroup: { name: g.name },
            });
          });
        });
        setCategories(flatCats);
      }
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Accounts
      const accountsRes = await fetch("/api/accounts");
      if (accountsRes.status === 401) {
        router.push("/signin");
        return;
      }
      const accountsData = await accountsRes.json();
      const loadedAccounts = accountsData.accounts || [];
      setAccounts(loadedAccounts);

      // 2. Fetch Transactions
      const txUrl = activeAccountId
        ? `/api/transactions?accountId=${activeAccountId}`
        : "/api/transactions";
      const txRes = await fetch(txUrl);
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);

      // 3. Set default account in modal form if active account is selected
      if (activeAccountId) {
        setFormData((prev) => ({ ...prev, accountId: activeAccountId }));
      } else if (loadedAccounts.length > 0) {
        setFormData((prev) => ({ ...prev, accountId: loadedAccounts[0].id }));
      }
    } catch (err) {
      console.error("Error fetching accounts/transactions data", err);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, router]);

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [fetchData, fetchCategories]);

  const activeAccount = accounts.find((acc) => acc.id === activeAccountId);

  const formatCurrency = (cents: number) => {
    const rupiah = cents / 100;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(rupiah);
  };

  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxLoading(true);

    try {
      const amountVal = parseFloat(formData.amountStr.replace(/[^0-9.-]+/g, ""));
      if (isNaN(amountVal)) return;

      // Handle sign of amount (expenses are negative, income is positive)
      // Transfers are always entered as positive value, but saved in DB as negative (outflow from source account)
      let cents = Math.round(amountVal * 100);
      if (txType === "standard" && formData.isOutflow) {
        cents = -cents;
      } else if (txType === "transfer") {
        cents = -cents; // Transferred out of source account
      }

      const payload = {
        date: formData.date,
        payee: txType === "transfer" 
          ? `Transfer ke ${accounts.find(a => a.id === formData.toAccountId)?.name}`
          : formData.payee,
        accountId: formData.accountId,
        toAccountId: txType === "transfer" ? formData.toAccountId : null,
        categoryId: txType === "standard" && !formData.isOutflow ? null : (formData.categoryId || null), // Income is unassigned
        memo: formData.memo,
        amount: cents,
        cleared: formData.cleared,
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData((prev) => ({
          ...prev,
          payee: "",
          amountStr: "",
          categoryId: "",
          memo: "",
        }));
        
        // Dispatch global event so sidebar updates account balances
        window.dispatchEvent(new Event("refresh-data"));
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to add transaction", err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;

    try {
      const res = await fetch(`/api/transactions?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        window.dispatchEvent(new Event("refresh-data"));
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to delete transaction", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and overview */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {activeAccount ? activeAccount.name : "Semua Rekening"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeAccount ? `Rekening ${activeAccount.type}` : "Gabungan seluruh catatan transaksi"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 px-6 py-3.5 rounded-2xl text-right">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Saldo Berjalan
            </p>
            <p
              className={`text-2xl font-extrabold mt-1 ${
                activeAccount
                  ? activeAccount.balance < 0
                    ? "text-red-500"
                    : "text-green-600 dark:text-green-400"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {activeAccount 
                ? formatCurrency(activeAccount.balance)
                : formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))}
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-brand-500/20 text-sm flex items-center gap-2"
          >
            <span className="text-lg">+</span> Tambah Transaksi
          </button>
        </div>
      </div>

      {/* Transaction Register Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-theme-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-white/[0.02]">
                <th className="py-4 px-6 w-[120px]">Tanggal</th>
                <th className="py-4 px-6 w-[140px]">Rekening</th>
                <th className="py-4 px-6">Penerima/Sumber</th>
                <th className="py-4 px-6">Kategori</th>
                <th className="py-4 px-6">Catatan</th>
                <th className="py-4 px-6 w-[140px] text-right">Jumlah</th>
                <th className="py-4 px-6 w-[80px] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isOutflow = tx.amount < 0;
                // If it's a transfer, we show destination in Category or Payee
                const isTransfer = tx.toAccountId !== null;

                // For rendering account name:
                const accountName = tx.account.name;

                return (
                  <tr
                    key={tx.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-white/[0.01]"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-6 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(tx.date).toLocaleDateString("id-ID", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Account */}
                    <td className="py-3.5 px-6 text-sm text-gray-600 dark:text-gray-400 font-medium truncate max-w-[130px]">
                      {accountName}
                    </td>

                    {/* Payee */}
                    <td className="py-3.5 px-6 text-sm font-semibold text-gray-800 dark:text-white/90 font-medium">
                      {tx.payee}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-6 text-sm">
                      {isTransfer ? (
                        <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold border border-purple-500/15">
                          🔄 Transfer
                        </span>
                      ) : tx.category ? (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-semibold">
                          {tx.category.categoryGroup.name} : {tx.category.name}
                        </span>
                      ) : (
                        <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-bold border border-green-500/15">
                          💵 Siap Dialokasikan
                        </span>
                      )}
                    </td>

                    {/* Memo */}
                    <td className="py-3.5 px-6 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={tx.memo || ""}>
                      {tx.memo || "-"}
                    </td>

                    {/* Amount */}
                    <td
                      className={`py-3.5 px-6 text-sm font-bold text-right ${
                        isOutflow ? "text-red-500" : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {formatCurrency(Math.abs(tx.amount))}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-6 text-center">
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="text-red-500 hover:text-red-650 text-sm font-semibold hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada transaksi di rekening ini. Klik "+ Tambah Transaksi" untuk memulai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD TRANSACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-lg overflow-hidden shadow-theme-lg">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                ➕ Tambah Transaksi Baru
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-650 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddTransactionSubmit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Transaction Type tab */}
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-white/[0.03] p-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setTxType("standard")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      txType === "standard"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-theme-xs border border-gray-100 dark:border-gray-850"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-850"
                    }`}
                  >
                    Pengeluaran / Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType("transfer")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      txType === "transfer"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-theme-xs border border-gray-100 dark:border-gray-850"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-850"
                    }`}
                  >
                    Transfer Antar Rekening
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                    />
                  </div>

                  {/* Account (Source Account) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      {txType === "transfer" ? "Rekening Asal" : "Rekening"}
                    </label>
                    <select
                      required
                      value={formData.accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Jumlah (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                      <input
                        type="text"
                        required
                        placeholder="0"
                        value={formData.amountStr !== "" ? Number(formData.amountStr).toLocaleString('id-ID') : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          setFormData({ ...formData, amountStr: digits });
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Flow Toggle (Standard Type Only) */}
                  {txType === "standard" ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Alur Keuangan
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-white/[0.03] p-1 rounded-xl border border-gray-100 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isOutflow: true })}
                          className={`py-1 text-xs font-semibold rounded-lg ${
                            formData.isOutflow
                              ? "bg-red-500 text-white shadow-theme-xs"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          Pengeluaran (-)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isOutflow: false })}
                          className={`py-1 text-xs font-semibold rounded-lg ${
                            !formData.isOutflow
                              ? "bg-green-600 text-white shadow-theme-xs"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          Pemasukan (+)
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Destination Account (Transfer Type Only) */
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Rekening Tujuan
                      </label>
                      <select
                        required
                        value={formData.toAccountId}
                        onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                      >
                        <option value="">-- Pilih Rekening --</option>
                        {accounts
                          .filter((acc) => acc.id !== formData.accountId)
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Standard Payee & Category Fields */}
                {txType === "standard" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Penerima / Sumber Dana
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="misal: Supermarket, Gaji Bulanan, Tagihan Listrik..."
                        value={formData.payee}
                        onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                      />
                    </div>

                    {/* Category Selection (Only if standard & outflow) */}
                    {formData.isOutflow && (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                          Kategori
                        </label>
                        <select
                          required
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                        >
                          <option value="">-- Pilih Kategori --</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.categoryGroup.name} : {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Memo */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                    Catatan
                  </label>
                  <input
                    type="text"
                    placeholder="Catatan tambahan (opsional)..."
                    value={formData.memo}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.01] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-sm font-semibold transition-all text-gray-700 dark:text-gray-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={txLoading || (txType === "transfer" && !formData.toAccountId)}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-55 disabled:hover:bg-brand-500 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-brand-500/20"
                >
                  {txLoading ? "Menyimpan..." : "Simpan Transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { Suspense } from "react";

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AccountsRegister />
    </Suspense>
  );
}
