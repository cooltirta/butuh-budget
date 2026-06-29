"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Category = {
  id: string;
  name: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type CategoryGroup = {
  id: string;
  name: string;
  categories: Category[];
};

export default function SettingsPage() {
  const router = useRouter();
  
  // States
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

      // Fetch accounts
      const accountsRes = await fetch("/api/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.accounts || []);
      }
    } catch (err) {
      console.error("Failed to load settings data", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleEditAccount = async (id: string, currentName: string) => {
    const newName = prompt("Masukkan nama baru rekening:", currentName);
    if (!newName || newName.trim() === "" || newName === currentName) return;

    try {
      const res = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName.trim() }),
      });

      if (res.ok) {
        showMessage("Nama rekening berhasil diubah!");
        window.dispatchEvent(new Event("refresh-data"));
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to edit account", err);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus rekening "${name}"? Seluruh data transaksi di rekening ini akan ikut terhapus secara permanen!`)) return;

    try {
      const res = await fetch(`/api/accounts?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showMessage("Rekening berhasil dihapus!");
        window.dispatchEvent(new Event("refresh-data"));
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to delete account", err);
    }
  };

  const handleEditCategoryGroup = async (id: string, currentName: string) => {
    const newName = prompt("Masukkan nama baru grup kategori:", currentName);
    if (!newName || newName.trim() === "" || newName === currentName) return;

    try {
      const res = await fetch("/api/settings/category-group", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName.trim() }),
      });

      if (res.ok) {
        showMessage("Nama grup kategori berhasil diubah!");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to edit category group", err);
    }
  };

  const handleDeleteCategoryGroup = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus grup kategori "${name}"? Seluruh pos pengeluaran di bawah grup ini akan ikut terhapus!`)) return;

    try {
      const res = await fetch(`/api/settings/category-group?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showMessage("Grup kategori berhasil dihapus!");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to delete category group", err);
    }
  };

  const handleEditCategory = async (id: string, currentName: string) => {
    const newName = prompt("Masukkan nama baru kategori:", currentName);
    if (!newName || newName.trim() === "" || newName === currentName) return;

    try {
      const res = await fetch("/api/settings/category", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName.trim() }),
      });

      if (res.ok) {
        showMessage("Nama kategori berhasil diubah!");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to edit category", err);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${name}"?`)) return;

    try {
      const res = await fetch(`/api/settings/category?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showMessage("Kategori berhasil dihapus!");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to delete category", err);
    }
  };

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

      {/* MANAGE BUDGET DATA SECTION */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚙️</span> Kelola Rekening & Kategori
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ubah nama atau hapus rekening bank dan pos anggaran pengeluaran.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manage Accounts List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Daftar Rekening
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/[0.04] transition-all"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{acc.name}</p>
                    <p className="text-xs text-gray-400">
                      Tipe: {acc.type === "CHECKING" ? "Giro/Utama" : acc.type === "SAVINGS" ? "Tabungan" : acc.type === "CREDIT_CARD" ? "Kartu Kredit" : "Kas Tunai"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditAccount(acc.id, acc.name)}
                      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-all"
                      title="Edit Nama"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id, acc.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Hapus Rekening"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-gray-450 dark:text-gray-500 text-center py-4">Belum ada rekening.</p>
              )}
            </div>
          </div>

          {/* Manage Category Groups & Categories tree */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Daftar Grup & Kategori Pos Anggaran
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {categoryGroups.map((g) => (
                <div
                  key={g.id}
                  className="p-4 bg-gray-50/30 dark:bg-white/[0.01] border border-gray-100/80 dark:border-gray-800/80 rounded-xl space-y-3"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between border-b border-gray-100/50 dark:border-gray-800/50 pb-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      📁 {g.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEditCategoryGroup(g.id, g.name)}
                        className="text-xs text-gray-400 hover:text-brand-500 transition-all px-1"
                        title="Edit Nama Grup"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteCategoryGroup(g.id, g.name)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-all px-1"
                        title="Hapus Grup"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Categories inside this group */}
                  <div className="pl-4 space-y-2">
                    {g.categories && g.categories.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800/55 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-all"
                      >
                        <span className="font-semibold text-gray-700 dark:text-gray-300">🏷️ {c.name}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleEditCategory(c.id, c.name)}
                            className="text-gray-400 hover:text-brand-500 transition-all"
                            title="Edit Kategori"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="text-gray-400 hover:text-red-500 transition-all"
                            title="Hapus Kategori"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!g.categories || g.categories.length === 0) && (
                      <p className="text-[10px] text-gray-450 dark:text-gray-500 italic">Belum ada kategori di grup ini.</p>
                    )}
                  </div>
                </div>
              ))}
              {categoryGroups.length === 0 && (
                <p className="text-xs text-gray-450 dark:text-gray-500 text-center py-4">Belum ada grup kategori.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
