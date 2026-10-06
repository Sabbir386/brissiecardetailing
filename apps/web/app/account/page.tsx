"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppointmentCard } from "@/components/appointment-card";
import { clientSend } from "@/lib/api";
import type { Booking } from "@/lib/types";

export default function AccountPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientSend<Booking[]>("/account/bookings")
      .then(setBookings)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const { next, upcoming, past } = useMemo(() => splitBookings(bookings || []), [bookings]);

  async function signOut() {
    try {
      await clientSend("/auth/logout", { method: "POST" });
    } catch {
      /* still leave */
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="page appt-page">
      <header className="appt-head">
        <div>
          <p className="appt-kicker">Account</p>
          <h1>Your appointments</h1>
        </div>
        <div className="appt-head-links">
          <Link className="appt-book-link" href="/">
            Book another
          </Link>
          {!error ? (
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="appt-empty">
          <h2>Sign in to see your bookings</h2>
          <p>Use the same mobile number you entered at checkout. Your confirmed times will show here.</p>
          <Link className="btn" href="/sign-in?next=/account">
            Sign in
          </Link>
        </div>
      ) : null}

      {!error && bookings === null ? <p className="appt-loading">Loading your appointments…</p> : null}

      {!error && bookings?.length === 0 ? (
        <div className="appt-empty">
          <h2>No appointments yet</h2>
          <p>When you book, the date, time, and service will show up here so you can find them in one tap.</p>
          <Link className="btn" href="/">
            Book an appointment
          </Link>
        </div>
      ) : null}

      {next ? (
        <section className="appt-section">
          <h2>Next appointment</h2>
          <AppointmentCard booking={next} featured cta="View booking" />
        </section>
      ) : null}

      {upcoming.length ? (
        <section className="appt-section">
          <h2>Upcoming</h2>
          <div className="appt-list">
            {upcoming.map((booking) => (
              <AppointmentCard booking={booking} key={booking.id} />
            ))}
          </div>
        </section>
      ) : null}

      {past.length ? (
        <section className="appt-section">
          <h2>Past</h2>
          <div className="appt-list">
            {past.map((booking) => (
              <AppointmentCard booking={booking} key={booking.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function splitBookings(bookings: Booking[]) {
  const now = Date.now();
  const upcomingAll = bookings
    .filter((booking) => booking.status === "confirmed" && new Date(booking.endAt || booking.startAt || 0).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = bookings
    .filter((booking) => booking.status !== "confirmed" || new Date(booking.endAt || booking.startAt || 0).getTime() < now)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  return { next: upcomingAll[0] || null, upcoming: upcomingAll.slice(1), past };
}
