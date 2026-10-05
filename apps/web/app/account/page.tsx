"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clientSend } from "@/lib/api";
import { money } from "@/lib/format";
import type { Booking } from "@/lib/types";

export default function AccountPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientSend<Booking[]>("/account/bookings")
      .then(setBookings)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <div className="page">
      <h1>Your appointments</h1>
      {error ? (
        <p>
          {error} <Link href="/sign-in?next=/account">Sign in</Link>
        </p>
      ) : null}
      {bookings?.length === 0 ? <p>No upcoming appointments yet.</p> : null}
      {bookings?.map((booking) => (
        <article className="card" key={booking.id}>
          <h2>{booking.label}</h2>
          <p>{booking.address}</p>
          <p>
            Deposit {money(booking.depositCents)} · Due{" "}
            {booking.balanceCents === null ? "quoted at the appointment" : money(booking.balanceCents)}
          </p>
          <Link href={`/confirmation?token=${booking.token}`}>View</Link>
        </article>
      ))}
    </div>
  );
}
