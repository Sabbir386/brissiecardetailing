import type { Metadata } from "next";
import Link from "next/link";
import { serverGet } from "@/lib/api";
import { money } from "@/lib/format";
import type { Booking } from "@/lib/types";

export const metadata: Metadata = {
  title: "Appointment booked",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  if (!params.token) {
    return (
      <div className="page">
        <h1>No appointment to show</h1>
      </div>
    );
  }
  let booking: Booking;
  try {
    booking = await serverGet<Booking>(`/bookings/token/${params.token}`, 0);
  } catch {
    return (
      <div className="page">
        <h1>Appointment not found</h1>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="center-card">
        <h1>You’re booked</h1>
        <p>{booking.label}</p>
        <p>{booking.address}</p>
        <ul className="clean">
          {booking.items.map((item) => (
            <li key={`${item.serviceName}-${item.optionName}`}>
              {item.serviceName} · {item.optionName}
              {item.requiresDropoff ? " · drop-off" : ""}
              {item.priceOnRequest ? " · price confirmed at the appointment" : ` · ${money(item.priceCents)}`}
            </li>
          ))}
        </ul>
        <div className="totals">
          <div>
            <span>Deposit paid</span>
            <span>{money(booking.depositCents)}</span>
          </div>
          <div>
            <span>Due at appointment</span>
            <span>{booking.balanceCents === null ? "Quoted after inspection" : money(booking.balanceCents)}</span>
          </div>
        </div>
        {booking.devPayment ? <p className="note">This deposit was recorded in test mode and was not charged to a bank.</p> : null}
        {booking.note ? <p className="note">Note: {booking.note}</p> : null}
        <Link className="btn" href="/">
          Back to services
        </Link>
      </div>
    </div>
  );
}
