import Link from "next/link";
import { money, vehicleLabel } from "@/lib/format";
import type { Booking } from "@/lib/types";

export function AppointmentCard({
  booking,
  featured = false,
  cta = "View details",
  showLink = true,
}: {
  booking: Booking;
  featured?: boolean;
  cta?: string;
  showLink?: boolean;
}) {
  const relative = relativeWhen(booking.startAt, booking.endAt);
  const cancelled = booking.status === "cancelled";
  const completed = booking.status === "completed";
  const past = !cancelled && (completed || (booking.endAt ? new Date(booking.endAt).getTime() < Date.now() : false));
  const status = cancelled ? "Cancelled" : completed ? "Completed" : "Confirmed";
  const collected = Boolean(booking.balanceCollected);
  return (
    <article className={`appt-card${featured ? " featured" : ""}${past ? " past" : ""}${cancelled ? " cancelled" : ""}`}>
      <div className="appt-card-top">
        <span className={`appt-status${completed ? " done" : ""}${cancelled ? " cancelled" : ""}`}>{status}</span>
        {relative && !cancelled && !completed ? <span className="appt-relative">{relative}</span> : null}
      </div>
      <p className="appt-day">{booking.dayLabel || booking.label}</p>
      <p className="appt-time">{booking.timeLabel || "Time confirmed"}</p>
      <ul className="appt-services">
        {booking.items.map((item) => (
          <li key={`${item.serviceName}-${item.optionName}`}>
            <strong>{item.serviceName}</strong>
            <span>{vehicleLabel(item.optionName)}</span>
          </li>
        ))}
      </ul>
      {booking.address ? <p className="appt-address">{booking.address}</p> : null}
      <div className="appt-money">
        <span>
          Deposit {booking.devPayment ? "recorded" : "paid"} <b>{money(booking.depositCents)}</b>
        </span>
        <span>
          {collected ? "Remaining collected" : "Due at appointment"}{" "}
          <b>{booking.balanceCents === null ? "Quoted" : money(booking.balanceCents)}</b>
        </span>
      </div>
      {showLink ? (
        <Link className="appt-view" href={`/confirmation?token=${booking.token}`}>
          {cta}
        </Link>
      ) : null}
    </article>
  );
}

function relativeWhen(startAt?: string, endAt?: string) {
  if (!startAt) return "";
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : start;
  const now = Date.now();
  if (now >= start && now <= end) return "Happening now";
  if (now > end) return "";
  const hours = (start - now) / 36e5;
  if (hours < 1) return "Starts soon";
  if (hours < 24) return "Today";
  if (hours < 48) return "Tomorrow";
  const days = Math.round(hours / 24);
  if (days < 8) return `In ${days} days`;
  return "";
}
