"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";

type User = {
  id: string;
  name: string;
};

export default function UserDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // If unauthorized, redirect to signin
          router.push("/signin");
        }
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      }
    };
    fetchUser();
  }, [router]);

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/signin");
        router.refresh();
      }
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (!user) return null;

  const isAyah = user.name.toLowerCase() === "ayah";

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center text-gray-700 dark:text-gray-400 dropdown-toggle"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl border-2 border-brand-500/20">
          {isAyah ? "👨‍💼" : "👩‍💼"}
        </span>

        <span className="block mr-1 font-semibold text-gray-800 dark:text-white/90 text-sm">
          {user.name}
        </span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[240px] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
          <span className="block font-semibold text-gray-900 dark:text-white">
            {user.name === "Ayah" ? "Ayah (Father)" : "Bunda (Mother)"}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {user.name.toLowerCase()}@wnab-shared.local
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 mt-3 font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-sm transition-all text-left"
        >
          <svg
            className="stroke-current"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M17 16L21 12M21 12L17 8M21 12H9M12 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H12"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sign Out
        </button>
      </Dropdown>
    </div>
  );
}
