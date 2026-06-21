"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  GridIcon,
  TableIcon,
  UserCircleIcon,
  HorizontaLDots,
  PieChartIcon,
} from "../icons/index";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number; // in cents
};

const formatCurrency = (cents: number) => {
  const rupiah = cents / 100;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(rupiah);
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Fetch accounts on load and refresh occasionally
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error("Failed to fetch accounts in sidebar", err);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();

    // Set up a listener for custom event 'refresh-data' to update account balances on transaction edits
    const handleRefresh = () => {
      fetchAccounts();
    };
    window.addEventListener("refresh-data", handleRefresh);
    return () => {
      window.removeEventListener("refresh-data", handleRefresh);
    };
  }, [fetchAccounts]);

  const isActive = useCallback((path: string) => pathname === path, [pathname]);

  const isAccountActive = useCallback(
    (accId: string) => {
      return pathname === "/dashboard/accounts" && 
             typeof window !== "undefined" && 
             new URLSearchParams(window.location.search).get("id") === accId;
    },
    [pathname]
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sidebar Header / Logo */}
      <div
        className={`py-6 flex border-b border-gray-100 dark:border-gray-800 mb-6 ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/dashboard/budget" className="flex items-center gap-2">
          <span className="text-2xl">💸</span>
          {(isExpanded || isHovered || isMobileOpen) && (
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              WNAB <span className="text-xs text-brand-500 font-semibold">CO-BUDGET</span>
            </span>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
        <nav className="mb-6">
          <div className="flex flex-col gap-6">
            {/* General section */}
            <div>
              <h2
                className={`mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "PENGANGGARAN"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link
                    href="/dashboard/budget"
                    className={`menu-item group ${
                      isActive("/dashboard/budget") ? "menu-item-active" : "menu-item-inactive"
                    }`}
                  >
                    <span className={isActive("/dashboard/budget") ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                      <GridIcon />
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">Lembar Anggaran</span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/reports"
                    className={`menu-item group ${
                      isActive("/dashboard/reports") ? "menu-item-active" : "menu-item-inactive"
                    }`}
                  >
                    <span className={isActive("/dashboard/reports") ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                      <PieChartIcon />
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">Laporan Keuangan</span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/accounts"
                    className={`menu-item group ${
                      isActive("/dashboard/accounts") && !isAccountActive("") ? "menu-item-active" : "menu-item-inactive"
                    }`}
                  >
                    <span className={isActive("/dashboard/accounts") && !isAccountActive("") ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                      <TableIcon />
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">Semua Rekening</span>
                    )}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Accounts section */}
            <div>
              <h2
                className={`mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "REKENING"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {isExpanded || isHovered || isMobileOpen ? (
                <ul className="flex flex-col gap-1 max-h-[250px] overflow-y-auto pr-1">
                  {accounts.map((acc) => (
                    <li key={acc.id}>
                      <Link
                        href={`/dashboard/accounts?id=${acc.id}`}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm transition-all ${
                          isAccountActive(acc.id)
                            ? "bg-brand-500/10 text-brand-500 font-semibold"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate max-w-[130px]">{acc.name}</span>
                        <span
                          className={`text-xs ${
                            acc.balance < 0
                              ? "text-red-500 font-medium"
                              : acc.balance > 0
                              ? "text-green-600 dark:text-green-400 font-medium"
                              : "text-gray-400"
                          }`}
                        >
                          {formatCurrency(acc.balance)}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {accounts.length === 0 && (
                    <li className="text-xs text-gray-400 px-3 py-1">Tidak ada rekening aktif</li>
                  )}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full text-gray-500" title="Rekening">
                    💳
                  </span>
                </div>
              )}
            </div>

            {/* Settings section */}
            <div>
              <h2
                className={`mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "KONFIGURASI"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link
                    href="/dashboard/settings"
                    className={`menu-item group ${
                      isActive("/dashboard/settings") ? "menu-item-active" : "menu-item-inactive"
                    }`}
                  >
                    <span className={isActive("/dashboard/settings") ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                      <UserCircleIcon />
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">Pengaturan & Berbagi</span>
                    )}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
