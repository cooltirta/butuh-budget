"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type NetWorthPoint = {
  month: string;
  assets: number;
  debt: number;
  netWorth: number;
};

type SpendingPoint = {
  name: string;
  value: number;
};

type IncomeExpensePoint = {
  month: string;
  income: number;
  expense: number;
};

type ReportsData = {
  netWorthHistory: NetWorthPoint[];
  spendingByCategoryGroup: SpendingPoint[];
  incomeVsExpense: IncomeExpensePoint[];
};

export default function ReportsPage() {
  const router = useRouter();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch("/api/reports");
        if (res.status === 401) {
          router.push("/signin");
          return;
        }
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch reports data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [router]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) return null;

  // 1. Net Worth Chart Settings
  const netWorthOptions: ApexOptions = {
    colors: ["#22c55e", "#ef4444", "#3b82f6"],
    chart: {
      fontFamily: "inherit",
      type: "line",
      toolbar: { show: false },
    },
    stroke: {
      width: [0, 0, 4],
      curve: "smooth",
    },
    plotOptions: {
      bar: {
        columnWidth: "40%",
        borderRadius: 4,
      },
    },
    fill: {
      opacity: [0.85, 0.85, 1],
    },
    xaxis: {
      categories: data.netWorthHistory.map((h) => h.month),
    },
    yaxis: {
      labels: {
        formatter: (val) => "Rp " + Math.round(val).toLocaleString("id-ID"),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
    },
    tooltip: {
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
  };

  const netWorthSeries = [
    {
      name: "Aset",
      type: "column",
      data: data.netWorthHistory.map((h) => h.assets),
    },
    {
      name: "Utang",
      type: "column",
      data: data.netWorthHistory.map((h) => h.debt),
    },
    {
      name: "Kekayaan Bersih (Net Worth)",
      type: "line",
      data: data.netWorthHistory.map((h) => h.netWorth),
    },
  ];

  // 2. Spending Pie Chart Settings
  const spendingOptions: ApexOptions = {
    colors: ["#3b82f6", "#a855f7", "#ec4899", "#f59e0b", "#14b8a6"],
    chart: {
      fontFamily: "inherit",
      type: "donut",
    },
    labels: data.spendingByCategoryGroup.map((s) => s.name),
    legend: {
      position: "bottom",
    },
    tooltip: {
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
        },
      },
    },
  };

  const spendingSeries = data.spendingByCategoryGroup.map((s) => s.value);

  // 3. Income vs Expense Chart Settings
  const incExpOptions: ApexOptions = {
    colors: ["#3b82f6", "#ef4444"],
    chart: {
      fontFamily: "inherit",
      type: "bar",
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "50%",
        borderRadius: 4,
      },
    },
    xaxis: {
      categories: data.incomeVsExpense.map((h) => h.month),
    },
    yaxis: {
      labels: {
        formatter: (val) => "Rp " + Math.round(val).toLocaleString("id-ID"),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
    },
    tooltip: {
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
  };

  const incExpSeries = [
    {
      name: "Pendapatan",
      data: data.incomeVsExpense.map((h) => h.income),
    },
    {
      name: "Pengeluaran",
      data: data.incomeVsExpense.map((h) => h.expense),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Keuangan</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Analisis ringkasan kekayaan bersih, pola pengeluaran, dan arus kas keluarga.
        </p>
      </div>

      {/* Net Worth Chart */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Kekayaan Bersih (Net Worth)</h2>
          <p className="text-xs text-gray-400">Total kekayaan bersih Anda (Aset - Utang Kartu Kredit) dalam 6 bulan terakhir.</p>
        </div>
        <div className="w-full h-[350px]">
          <ReactApexChart
            options={netWorthOptions}
            series={netWorthSeries}
            type="line"
            height="100%"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income vs Expense Chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pendapatan vs Pengeluaran</h2>
            <p className="text-xs text-gray-400">Perbandingan pemasukan unassigned vs pengeluaran kategori 6 bulan terakhir.</p>
          </div>
          <div className="w-full h-[300px]">
            <ReactApexChart
              options={incExpOptions}
              series={incExpSeries}
              type="bar"
              height="100%"
            />
          </div>
        </div>

        {/* Spending Allocation (Pie Chart) */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Alokasi Pengeluaran Bulan Ini</h2>
            <p className="text-xs text-gray-400">Distribusi pengeluaran berdasarkan grup kategori pada bulan berjalan.</p>
          </div>
          {data.spendingByCategoryGroup.length > 0 ? (
            <div className="w-full h-[250px] flex items-center justify-center">
              <ReactApexChart
                options={spendingOptions}
                series={spendingSeries}
                type="donut"
                width="100%"
                height="100%"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-12">
              Belum ada transaksi pengeluaran tercatat di bulan ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
