"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInForm() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (role: "ayah" | "bunda") => {
    setLoading(role);
    setError(null);
    try {
      const res = await fetch("/api/auth/login-dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login gagal");
      }

      // Redirect to budget page
      router.push("/dashboard/budget");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto p-4">
      <div className="mb-8 text-center">
        <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
          WNAB 💸
        </h1>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          We Need a Budget (Butuh Anggaran)
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Pengelolaan anggaran keluarga kolaboratif. Pilih profil untuk masuk:
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={() => handleLogin("ayah")}
          disabled={loading !== null}
          className="w-full flex items-center justify-between p-5 text-left border-2 border-blue-500/20 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all rounded-2xl group"
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">👨‍💼</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Masuk sebagai Ayah
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Kelola anggaran & transaksi sebagai Kepala Keluarga
              </p>
            </div>
          </div>
          {loading === "ayah" ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="text-blue-500 group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          )}
        </button>

        <button
          onClick={() => handleLogin("bunda")}
          disabled={loading !== null}
          className="w-full flex items-center justify-between p-5 text-left border-2 border-purple-500/20 hover:border-purple-500 bg-purple-500/5 hover:bg-purple-500/10 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 transition-all rounded-2xl group"
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">👩‍💼</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Masuk sebagai Bunda
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Kelola anggaran & transaksi bersama Ayah
              </p>
            </div>
          </div>
          {loading === "bunda" ? (
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="text-purple-500 group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          )}
        </button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Mode pengelolaan bersama aktif. Semua perubahan disinkronkan secara real-time.
        </p>
      </div>
    </div>
  );
}
