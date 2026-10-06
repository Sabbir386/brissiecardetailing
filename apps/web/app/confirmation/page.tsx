import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointment-card";
import { serverGet } from "@/lib/api";
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
      <div className="page appt-page">
        <div className="appt-empty">
          <h1>No appointment to show</h1>
          <Link className="btn" href="/account">
            Your appointments
          </Link>
        </div>
      </div>
    );
  }
  let booking: Booking;
  try {
    booking = await serverGet<Booking>(`/bookings/token/${params.token}`, 0);
  } catch {
    return (
      <div className="page appt-page">
        <div className="appt-empty">
          <h1>Appointment not found</h1>
          <Link className="btn" href="/account">
            Your appointments
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="page appt-page">
      <header className="appt-head">
        <div>
          <p className="appt-kicker">You’re booked</p>
          <h1>Appointment confirmed</h1>
        </div>
        <Link className="appt-book-link" href="/account">
          Your appointments
        </Link>
      </header>
      <AppointmentCard booking={booking} featured showLink={false} />
      {booking.devPayment ? (
        <p className="note">This deposit was recorded in test mode and was not charged to a bank.</p>
      ) : null}
      {booking.note ? <p className="note">Note: {booking.note}</p> : null}
      <div className="appt-actions">
        <Link className="btn" href="/account">
          View my appointments
        </Link>
        <Link className="appt-secondary" href="/">
          Back to services
        </Link>
      </div>
    </div>
  );
}
