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
    startingBalanceStr: "0.00",
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

      if (!accRes.ok) throw new Error("Failed to create account");

      const accJson = await accRes.json();
      const accountId = accJson.account.id;

      // 2. Add starting balance transaction if > 0
      const balVal = parseFloat(accountForm.startingBalanceStr);
      if (!isNaN(balVal) && balVal !== 0) {
        const cents = Math.round(balVal * 100);
        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: new Date().toISOString().split("T")[0],
            payee: "Starting Balance",
            accountId,
            toAccountId: null,
            categoryId: null, // Ready to assign
            memo: "Account opened",
            amount: cents,
            cleared: true,
          }),
        });
      }

      showMessage("Account created successfully!");
      setAccountForm({ name: "", type: "CHECKING", startingBalanceStr: "0.00" });
      
      // Dispatch refresh event to update sidebar
      window.dispatchEvent(new Event("refresh-data"));
    } catch (err: any) {
      showMessage(err.message || "Failed to create account", "error");
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

      if (!res.ok) throw new Error("Failed to create category group");

      showMessage("Category group created!");
      setGroupForm({ name: "" });
      await fetchData();
    } catch (err: any) {
      showMessage(err.message || "Failed to create group", "error");
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

      if (!res.ok) throw new Error("Failed to create category");

      showMessage("Category created!");
      setCategoryForm((prev) => ({ ...prev, name: "" }));
      await fetchData();
    } catch (err: any) {
      showMessage(err.message || "Failed to create category", "error");
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings & Sharing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your shared budget workspace, accounts, and envelopes.
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
            <span>🤝</span> Budget Co-management
          </h2>
          <p className="text-sm text-gray-500">
            This budget is shared and co-managed in real-time. Any adjustments to accounts or categories will immediately update for both partners.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👨‍💼</span>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Ayah (Father)</p>
                  <p className="text-xs text-gray-400">Owner role</p>
                </div>
              </div>
              <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                Connected 🟢
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👩‍💼</span>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Bunda (Mother)</p>
                  <p className="text-xs text-gray-400">Co-manager role</p>
                </div>
              </div>
              <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                Connected 🟢
              </span>
            </div>
          </div>
        </div>

        {/* Add Account form */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>💳</span> Add New Account
          </h2>
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Account Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Credit Card Gold, Joint Checking..."
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Account Type
                </label>
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
                >
                  <option value="CHECKING">Checking Account</option>
                  <option value="SAVINGS">Savings Account</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="CASH">Cash / Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Starting Balance ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={accountForm.startingBalanceStr}
                    onChange={(e) => setAccountForm({ ...accountForm, startingBalanceStr: e.target.value })}
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={accLoading || !accountForm.name}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
            >
              {accLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Category Group */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📁</span> Add Category Group
          </h2>
          <form onSubmit={handleAddCategoryGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Group Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Subscriptions, Kids, Projects..."
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
              {groupLoading ? "Creating Group..." : "Create Category Group"}
            </button>
          </form>
        </div>

        {/* Add Category under Group */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>🏷️</span> Add Category (Envelope)
          </h2>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Category Group
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
                Category Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Netflix, School Fees, Pocket Money..."
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
              {catLoading ? "Creating Category..." : "Create Category"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
