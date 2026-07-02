"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushAlertsButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications are not supported by your browser.");
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Permission denied for push notifications.");
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string
        ),
      });

      await fetch("/api/pulse/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      setIsSubscribed(true);
    } catch (e) {
      console.error(e);
      alert("Failed to subscribe to push notifications.");
    } finally {
      setLoading(false);
    }
  }

  if (isSubscribed) {
    return (
      <div className="mb-7 flex items-center justify-between rounded-2xl border border-proof/30 bg-proof/8 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-proof/15">
            <Bell className="size-5 text-proof" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">Goal Alerts Active</p>
            <p className="truncate text-xs text-text-dim">You'll be notified of live goals.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={loading}
      className="mb-7 flex w-full items-center justify-between rounded-2xl border border-signal/30 bg-signal/8 p-4 text-left transition-colors hover:bg-signal/12 disabled:opacity-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-signal/15">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-signal" aria-hidden />
          ) : (
            <Bell className="size-5 text-signal" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Enable Goal Alerts</p>
          <p className="truncate text-xs text-text-dim">Get instant notifications when a team scores.</p>
        </div>
      </div>
    </button>
  );
}
