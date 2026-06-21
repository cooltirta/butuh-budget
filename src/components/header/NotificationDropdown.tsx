"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

type Notification = {
  id: string;
  message: string;
  readBy: string[];
  createdAt: string;
};

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
        setUnreadCount(json.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // Refresh notifications occasionally (every 30 seconds)
    const interval = setInterval(fetchNotifications, 30000);
    
    // Also listen for local refresh-data events
    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener("refresh-data", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-data", handleRefresh);
    };
  }, [fetchNotifications]);

  const toggleDropdown = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    // If opening, mark all notifications as read
    if (nextState && unreadCount > 0) {
      try {
        const res = await fetch("/api/notifications", { method: "POST" });
        if (res.ok) {
          setUnreadCount(0);
        }
      } catch (err) {
        console.error("Failed to mark notifications as read", err);
      }
    }
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return date.toLocaleDateString("id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative">
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
      >
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0.5 z-10 h-4 min-w-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            Aktivitas Terkini (Notifikasi)
          </h5>
          <span className="text-xs bg-gray-100 dark:bg-white/5 text-gray-400 px-2 py-0.5 rounded-full font-bold">
            Co-Management
          </span>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar flex-1 space-y-1">
          {notifications.map((notif) => {
            const isRead = notif.readBy.length > 0; // Simple read indicators
            return (
              <li key={notif.id}>
                <div className="flex flex-col p-3 rounded-xl border-b border-gray-100 dark:border-gray-800 text-sm hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-all">
                  <p className="text-gray-800 dark:text-white/90 font-medium leading-relaxed">
                    {notif.message}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                    <span>🕒</span> {formatTimeAgo(notif.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
          {notifications.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-12">
              <span className="text-3xl mb-2">🔔</span>
              <span>Belum ada aktivitas terekam.</span>
            </div>
          )}
        </ul>
      </Dropdown>
    </div>
  );
}
