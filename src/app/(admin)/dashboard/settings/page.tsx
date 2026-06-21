"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type CategoryGroup = {
  id: string;
  name: string;
};

export default function SettingsPage() {
  const router = useRouter();
  
  // States
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "CHECKING",
    startingBalanceStr: "0",
  });
  const [groupForm, setGroupForm] = useState({
    name: "",
  });
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    groupId: "",
  });

  const [accLoading, setAccLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [catLoading, setCatLoading] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/budget?month=" + new Date().toISOString().split("T")[0].substring(0, 7) + "-01");
      if (res.status === 401) {
        router.push("/signin");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setCategoryGroups(json.categoryGroups || []);
        if (json.categoryGroups && json.categoryGroups.length > 0) {
          setCategoryForm((prev) => ({ ...prev, groupId: json.categoryGroups[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load settings data", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccLoading(true);
    try {
      // 1. Create account
      const accRes = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountForm.name,
          type: accountForm.type,
        }),
      });

      if (!accRes.ok) throw new Error("Gagal membuat rekening");

      const accJson = await accRes.json();
      const accountId = accJson.account.id;

      // 2. Add starting balance transaction if > 0
      const balVal = parseFloat(accountForm.startingBalanceStr.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(balVal) && balVal !== 0) {
        const cents = Math.round(balVal * 100);
        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: new Date().toISOString().split("T")[0],
            payee: "Saldo Awal",
            accountId,
            toAccountId: null,
            categoryId: null, // Siap Dialokasikan
            memo: "Pembukaan rekening",
            amount: cents,
            cleared: true,
          }),
        });
      }

      showMessage("Rekening baru berhasil dibuat!");
      setAccountForm({ name: "", type: "CHECKING", startingBalanceStr: "0" });
      
      // Dispatch refresh event to update sidebar
      window.dispatchEvent(new Event("refresh-data"));
    } catch (err: any) {
      showMessage(err.message || "Gagal membuat rekening", "error");
    } finally {
      setAccLoading(false);
    }
  };

  const handleAddCategoryGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupLoading(true);
    try {
      const res = await fetch("/api/settings/category-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupForm.name }),
      });

      if (!res.ok) throw new Error("Gagal membuat grup kategori");

      showMessage("Grup kategori berhasil dibuat!");
      setGroupForm({ name: "" });
      await fetchData();
    } catch (err: any) {
      showMessage(err.message || "Gagal membuat grup kategori", "error");
    } finally {
      setGroupLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatLoading(true);
    try {
      const res = await fetch("/api/settings/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          categoryGroupId: categoryForm.groupId,
        }),
      });

      if (!res.ok) throw new Error("Gagal membuat kategori");

      showMessage("Kategori baru berhasil dibuat!");
      setCategoryForm((prev) => ({ ...prev, name: "" }));
      await fetchData();
    } catch (err: any) {
      showMessage(err.message || "Gagal membuat kategori", "error");
    } finally {
      setCatLoading(false);
    }
  };

  if (loading && categoryGroups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan & Berbagi</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kelola anggaran bersama, rekening bank, dan pos pengeluaran keluarga.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold ${
            message.type === "success"
              ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Collaborative status card */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🤝</span> Pengelolaan Anggaran Bersama
          </h2>
          <p className="text-sm text-gray-500">
            Anggaran ini dikelola bersama secara real-time. Setiap penyesuaian rekening atau alokasi kategori akan langsung diperbarui di kedua perangkat (Ayah & Bunda).
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👨‍💼</span>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Ayah (Kepala Keluarga)</p>
                  <p className="text-xs text-gray-400">Pemilik Utama</p>
                </div>
              </div>
              <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                Terhubung 🟢
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👩‍💼</span>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Bunda (Istri)</p>
                  <p className="text-xs text-gray-400">Pengelola Bersama</p>
                </div>
              </div>
              <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                Terhubung 🟢
              </span>
            </div>
          </div>
        </div>

        {/* Add Account form */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>💳</span> Tambah Rekening Baru
          </h2>
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Nama Rekening
              </label>
              <input
                type="text"
                required
                placeholder="misal: BCA Tabungan, Kartu Kredit Mandiri, Dompet Kas..."
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Tipe Rekening
                </label>
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
                >
                  <option value="CHECKING">Rekening Giro / Utama</option>
                  <option value="SAVINGS">Tabungan</option>
                  <option value="CREDIT_CARD">Kartu Kredit</option>
                  <option value="CASH">Kas Tunai / Dompet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Saldo Awal (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                  <input
                    type="text"
                    required
                    value={accountForm.startingBalanceStr !== "" ? Number(accountForm.startingBalanceStr).toLocaleString('id-ID') : ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      setAccountForm({ ...accountForm, startingBalanceStr: digits });
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={accLoading || !accountForm.name}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
            >
              {accLoading ? "Membuat Rekening..." : "Buat Rekening"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Category Group */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📁</span> Tambah Grup Kategori
          </h2>
          <form onSubmit={handleAddCategoryGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Nama Grup
              </label>
              <input
                type="text"
                required
                placeholder="misal: Pendidikan Anak, Liburan, Tagihan Bulanan..."
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={groupLoading || !groupForm.name}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
            >
              {groupLoading ? "Membuat Grup..." : "Buat Grup Kategori"}
            </button>
          </form>
        </div>

        {/* Add Category under Group */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>🏷️</span> Tambah Kategori (Pos Pengeluaran)
          </h2>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Grup Kategori
              </label>
              <select
                value={categoryForm.groupId}
                onChange={(e) => setCategoryForm({ ...categoryForm, groupId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
              >
                {categoryGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Nama Kategori
              </label>
              <input
                type="text"
                required
                placeholder="misal: Uang Saku, SPP Sekolah, Internet..."
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={catLoading || !categoryForm.name || !categoryForm.groupId}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
            >
              {catLoading ? "Membuat Kategori..." : "Buat Kategori"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
