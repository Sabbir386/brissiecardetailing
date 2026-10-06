import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPanel } from "@/components/admin-panel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="page shop-page">Loading the website desk…</div>}>
      <AdminPanel />
    </Suspense>
  );
}
