import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { getBusiness } from "@/lib/api";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ hold?: string }>;
}) {
  const params = await searchParams;
  const business = await getBusiness();
  if (!params.hold) {
    return (
      <div className="page">
        <h1>Choose a time first</h1>
        <p>Your appointment hold starts when you pick an open slot.</p>
      </div>
    );
  }
  return <CheckoutForm holdId={params.hold} business={business} />;
}
