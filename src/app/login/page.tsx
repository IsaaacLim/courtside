"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError("Incorrect password");
    }
  }

  return (
    <div className="min-h-[70vh] flex flex-col justify-center">
      <h1 className="text-2xl font-bold mb-1">Volleyball Payments</h1>
      <p className="text-neutral-500 mb-6">Host login</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="password"
          inputMode="text"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {loading ? "…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
