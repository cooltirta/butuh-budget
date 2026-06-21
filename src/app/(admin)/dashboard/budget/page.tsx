"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type CategoryBudget = {
  id: string;
  name: string;
  assigned: number;
  activity: number;
  available: number;
};

type CategoryGroup = {
  id: string;
  name: string;
  categories: CategoryBudget[];
};

type BudgetData = {
  readyToAssign: number;
  totalBudgeted: number;
  totalActivity: number;
  totalAvailable: number;
  categoryGroups: CategoryGroup[];
};

export default function BudgetSheet() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<{ [catId: string]: string }>({});

  // Overlay/Modal state for "Roll with the punches" (covering overspending)
  const [overspentCat, setOverspentCat] = useState<CategoryBudget | null>(null);
  const [coverSourceCatId, setCoverSourceCatId] = useState<string>("");
  const [coverAmount, setCoverAmount] = useState<string>("");
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

  const getMonthStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const fetchBudget = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = getMonthStr(currentDate);
      const res = await fetch(`/api/budget?month=${monthStr}`);
      if (res.status === 401) {
        router.push("/signin");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setData(json);

        // Prepopulate editing values
        const editValues: { [catId: string]: string } = {};
        json.categoryGroups.forEach((group: CategoryGroup) => {
          group.categories.forEach((cat: CategoryBudget) => {
            editValues[cat.id] = (cat.assigned / 100).toFixed(0); // integer for Rp
          });
        });
        setEditingValue(editValues);
      }
    } catch (err) {
      console.error("Error fetching budget sheet", err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, router]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const changeMonth = (offset: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const formatMonthName = (date: Date) => {
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  };

  const formatCurrency = (cents: number) => {
    const rupiah = cents / 100;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(rupiah);
  };

  const handleAssignedChange = (catId: string, val: string) => {
    setEditingValue((prev) => ({ ...prev, [catId]: val }));
  };

  const saveAssignment = async (catId: string, valueStr: string) => {
    const numericVal = parseFloat(valueStr.replace(/[^0-9.-]+/g, ""));
    if (isNaN(numericVal)) return;

    setSavingCategory(catId);
    try {
      const cents = Math.round(numericVal * 100);
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: catId,
          month: getMonthStr(currentDate),
          assigned: cents,
        }),
      });

      if (res.ok) {
        // Dispatch event to refresh accounts balance in sidebar
        window.dispatchEvent(new Event("refresh-data"));
        await fetchBudget();
      }
    } catch (err) {
      console.error("Failed to save assignment", err);
    } finally {
      setSavingCategory(null);
    }
  };

  // COVER OVERSPENDING: Move money from source category to overspent category
  const handleCoverOverspending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overspentCat || !coverSourceCatId || !coverAmount) return;

    const amountInRupiah = parseFloat(coverAmount);
    if (isNaN(amountInRupiah) || amountInRupiah <= 0) return;

    const amountCents = Math.round(amountInRupiah * 100);

    // Find source category details
    let sourceCat: CategoryBudget | undefined;
    data?.categoryGroups.forEach((g) => {
      const found = g.categories.find((c) => c.id === coverSourceCatId);
      if (found) sourceCat = found;
    });

    if (!sourceCat) return;

    try {
      setLoading(true);
      // 1. Subtract from Source Category
      const newSourceAssigned = sourceCat.assigned - amountCents;
      await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: coverSourceCatId,
          month: getMonthStr(currentDate),
          assigned: newSourceAssigned,
        }),
      });

      // 2. Add to Overspent Category
      const newOverspentAssigned = overspentCat.assigned + amountCents;
      await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: overspentCat.id,
          month: getMonthStr(currentDate),
          assigned: newOverspentAssigned,
        }),
      });

      setIsCoverModalOpen(false);
      setOverspentCat(null);
      setCoverSourceCatId("");
      setCoverAmount("");

      // Refresh
      window.dispatchEvent(new Event("refresh-data"));
      await fetchBudget();
    } catch (err) {
      console.error("Failed to cover overspending", err);
    } finally {
      setLoading(false);
    }
  };

  const openCoverModal = (cat: CategoryBudget) => {
    setOverspentCat(cat);
    const absOverspent = Math.abs(cat.available);
    setCoverAmount((absOverspent / 100).toFixed(0));
    setIsCoverModalOpen(true);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation & Summary Cards */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => changeMonth(-1)}
            className="flex items-center justify-center w-10 h-10 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-lg"
          >
            &larr;
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white min-w-[200px] text-center">
            {formatMonthName(currentDate)}
          </h1>
          <button
            onClick={() => changeMonth(1)}
            className="flex items-center justify-center w-10 h-10 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-lg"
          >
            &rarr;
          </button>
        </div>

        {/* Ready to Assign (RTA) banner */}
        <div
          className={`flex items-center justify-between gap-6 px-6 py-4 rounded-2xl border-2 transition-all ${
            (data?.readyToAssign ?? 0) < 0
              ? "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400"
              : (data?.readyToAssign ?? 0) > 0
              ? "bg-green-500/10 border-green-500/25 text-green-700 dark:text-green-400"
              : "bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
          }`}
        >
          <div>
            <p className="text-xs uppercase font-bold tracking-wider opacity-85">
              Siap Dialokasikan
            </p>
            <p className="text-3xl font-extrabold mt-1">
              {formatCurrency(data?.readyToAssign ?? 0)}
            </p>
          </div>
          <span className="text-3xl">
            {(data?.readyToAssign ?? 0) < 0 ? "⚠️" : (data?.readyToAssign ?? 0) > 0 ? "💰" : "⚖️"}
          </span>
        </div>
      </div>

      {/* Monthly Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Total Dianggarkan
            </p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
              {formatCurrency(data?.totalBudgeted ?? 0)}
            </p>
          </div>
          <span className="text-xl p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-xl">💸</span>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Total Aktivitas
            </p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
              {formatCurrency(data?.totalActivity ?? 0)}
            </p>
          </div>
          <span className="text-xl p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-500 rounded-xl">📉</span>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Total Tersedia
            </p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
              {formatCurrency(data?.totalAvailable ?? 0)}
            </p>
          </div>
          <span className="text-xl p-3 bg-green-50 dark:bg-green-950/20 text-green-500 rounded-xl">🏦</span>
        </div>
      </div>

      {/* Budget Grid Sheet */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-theme-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-white/[0.02]">
                <th className="py-4 px-6">Kategori</th>
                <th className="py-4 px-6 w-[200px] text-right">Dianggarkan</th>
                <th className="py-4 px-6 w-[180px] text-right">Aktivitas</th>
                <th className="py-4 px-6 w-[180px] text-right">Tersedia</th>
              </tr>
            </thead>
            <tbody>
              {data?.categoryGroups.map((group) => (
                <React.Fragment key={group.id}>
                  {/* Category Group Header Row */}
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.01]">
                    <td colSpan={4} className="py-3 px-6 font-bold text-sm text-gray-800 dark:text-white/90">
                      {group.name}
                    </td>
                  </tr>

                  {/* Categories Row */}
                  {group.categories.map((cat) => {
                    const isAvailableNegative = cat.available < 0;
                    const isAvailablePositive = cat.available > 0;
                    const isSaving = savingCategory === cat.id;

                    return (
                      <tr
                        key={cat.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-white/[0.01]"
                      >
                        {/* Name */}
                        <td className="py-3.5 px-6 font-medium text-sm text-gray-800 dark:text-white/80">
                          {cat.name}
                        </td>

                        {/* Assigned Input */}
                        <td className="py-3.5 px-6 text-right">
                          <div className="relative inline-block w-full max-w-[150px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-450 text-xs font-semibold">Rp</span>
                            <input
                              type="text"
                              value={editingValue[cat.id] !== undefined ? Number(editingValue[cat.id]).toLocaleString('id-ID') : ""}
                              onChange={(e) => {
                                // Strip formatting, keep digits
                                const digits = e.target.value.replace(/[^0-9]/g, "");
                                handleAssignedChange(cat.id, digits);
                              }}
                              onBlur={() => saveAssignment(cat.id, editingValue[cat.id] || "0")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveAssignment(cat.id, editingValue[cat.id] || "0");
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              disabled={isSaving}
                              className={`w-full text-right bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-gray-100 dark:border-gray-800 rounded-lg py-1 px-3 pl-8 text-sm font-semibold text-gray-700 dark:text-white focus:border-brand-500 focus:outline-hidden focus:ring-1 focus:ring-brand-500 ${
                                isSaving ? "opacity-50" : ""
                              }`}
                            />
                          </div>
                        </td>

                        {/* Activity */}
                        <td className="py-3.5 px-6 text-right font-semibold text-sm text-gray-650 dark:text-gray-400">
                          {formatCurrency(cat.activity)}
                        </td>

                        {/* Available Balance Pill */}
                        <td className="py-3.5 px-6 text-right">
                          <span
                            onClick={() => isAvailableNegative && openCoverModal(cat)}
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              isAvailableNegative
                                ? "bg-red-500/20 text-red-500 border border-red-500/20 cursor-pointer hover:bg-red-500/30"
                                : isAvailablePositive
                                ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20"
                                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                            }`}
                            title={isAvailableNegative ? "Klik untuk menutup pengeluaran berlebih!" : undefined}
                          >
                            {formatCurrency(cat.available)}
                            {isAvailableNegative && <span className="ml-1 text-[10px]">🩹</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              {(data?.categoryGroups.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    Belum ada grup kategori. Tambahkan di Pengaturan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROLL WITH THE PUNCHES - COVER OVERSPENDING MODAL */}
      {isCoverModalOpen && overspentCat && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md overflow-hidden shadow-theme-lg">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🩹</span> Atur Ulang Anggaran
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Tutup pengeluaran berlebih di kategori <strong>{overspentCat.name}</strong> dengan memindahkan dana.
              </p>
            </div>
            <form onSubmit={handleCoverOverspending}>
              <div className="p-6 space-y-4">
                {/* Status bar */}
                <div className="p-3.5 bg-red-500/10 text-red-500 font-semibold rounded-xl text-xs flex justify-between">
                  <span>Kelebihan Pengeluaran:</span>
                  <span>{formatCurrency(overspentCat.available)}</span>
                </div>

                {/* Amount to move */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                    Jumlah Dana yang Dipindahkan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                    <input
                      type="text"
                      required
                      value={Number(coverAmount).toLocaleString('id-ID')}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        setCoverAmount(digits);
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Source Category selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                    Pindahkan Uang Dari Kategori
                  </label>
                  <select
                    required
                    value={coverSourceCatId}
                    onChange={(e) => setCoverSourceCatId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:border-brand-500 focus:outline-hidden"
                  >
                    <option value="">-- Pilih Kategori Sumber --</option>
                    {data?.categoryGroups.map((group) => (
                      <optgroup key={group.id} label={group.name}>
                        {group.categories
                          .filter((c) => c.id !== overspentCat.id && c.available > 0)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Tersedia: {formatCurrency(c.available)})
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.01] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCoverModalOpen(false);
                    setOverspentCat(null);
                  }}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-sm font-semibold transition-all text-gray-700 dark:text-gray-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!coverSourceCatId || !coverAmount}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-55 disabled:hover:bg-brand-500 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-brand-500/20"
                >
                  Konfirmasi Pindah Dana
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
