"use client";

import { useEffect, useState } from "react";
import { clientSend } from "@/lib/api";
import { money } from "@/lib/format";
import type { Booking, Service } from "@/lib/types";

type Overview = {
  services: (Service & { categoryName: string })[];
  hours: { dayOfWeek: number; openMin: number; closeMin: number; closed: boolean }[];
  blocked: { date: string; reason: string | null }[];
  bookings: Booking[];
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AdminPanel() {
  const [admin, setAdmin] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const me = await clientSend<{ admin: { email: string } | null }>("/admin/me");
    setAdmin(me.admin?.email ?? null);
    if (me.admin) setOverview(await clientSend<Overview>("/admin/overview"));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await clientSend("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    }
  }

  if (!admin) {
    return (
      <form className="center-card" onSubmit={login}>
        <h1>Admin</h1>
        <label className="field">
          Email
          <input name="email" type="email" defaultValue="admin@brissiecardetailing.local" required />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          Sign in
        </button>
      </form>
    );
  }

  if (!overview) return <div className="page">Loading the shop…</div>;

  return (
    <div className="page admin-grid">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Shop</h1>
        <button
          className="btn slim secondary"
          onClick={async () => {
            await clientSend("/admin/logout", { method: "POST" });
            setAdmin(null);
          }}
        >
          Sign out
        </button>
      </div>
      <section className="card">
        <h2>Upcoming and recent appointments</h2>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Customer</th>
              <th>Deposit</th>
            </tr>
          </thead>
          <tbody>
            {overview.bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.label}</td>
                <td>
                  {booking.customer.firstName} {booking.customer.lastName}
                  <div className="note">{booking.items.map((item) => item.serviceName).join(", ")}</div>
                </td>
                <td>{money(booking.depositCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {overview.services.map((service) => (
        <ServiceEditor key={service.id} service={service} onSaved={load} />
      ))}
      <HoursEditor hours={overview.hours} onSaved={load} />
      <BlockedEditor blocked={overview.blocked} onSaved={load} />
    </div>
  );
}

function ServiceEditor({ service, onSaved }: { service: Service & { categoryName: string }; onSaved: () => Promise<void> }) {
  const [summary, setSummary] = useState(service.summary);
  const [deposit, setDeposit] = useState(service.depositCents / 100);
  const [isAddon, setAddon] = useState(service.isAddon);
  const [dropoff, setDropoff] = useState(service.requiresDropoff);
  const [options, setOptions] = useState(service.options);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");
    await clientSend(`/admin/services/${service.id}`, {
      method: "PUT",
      body: JSON.stringify({
        summary,
        depositCents: Math.round(deposit * 100),
        isAddon,
        requiresDropoff: dropoff,
        options: options.map((option) => ({
          id: option.id,
          name: option.name,
          priceCents: Math.round(option.priceCents),
          durationMinutes: option.durationMinutes,
          priceOnRequest: option.priceOnRequest,
        })),
      }),
    });
    setMessage("Saved");
    await onSaved();
  }

  return (
    <section className="card">
      <h2>
        {service.categoryName} · {service.name}
      </h2>
      <label className="field">
        Short description
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} />
      </label>
      <div className="row-2">
        <label className="field">
          Deposit dollars
          <input type="number" min={0} value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={isAddon} onChange={(event) => setAddon(event.target.checked)} /> Add-on only
        </label>
        <label className="check">
          <input type="checkbox" checked={dropoff} onChange={(event) => setDropoff(event.target.checked)} /> Drop-off
        </label>
      </div>
      {options.map((option, index) => (
        <div className="row-3" key={option.id}>
          <label className="field">
            Option
            <input
              value={option.name}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, name: event.target.value };
                setOptions(next);
              }}
            />
          </label>
          <label className="field">
            Price cents
            <input
              type="number"
              value={option.priceCents}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, priceCents: Number(event.target.value) };
                setOptions(next);
              }}
            />
          </label>
          <label className="field">
            Minutes
            <input
              type="number"
              value={option.durationMinutes}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, durationMinutes: Number(event.target.value) };
                setOptions(next);
              }}
            />
          </label>
        </div>
      ))}
      <button className="btn slim" type="button" onClick={() => save().catch((reason: Error) => setMessage(reason.message))}>
        Save service
      </button>
      {message ? <p className="note">{message}</p> : null}
    </section>
  );
}

function HoursEditor({
  hours,
  onSaved,
}: {
  hours: { dayOfWeek: number; openMin: number; closeMin: number; closed: boolean }[];
  onSaved: () => Promise<void>;
}) {
  const [rows, setRows] = useState(hours);
  async function save() {
    await clientSend("/admin/hours", { method: "PUT", body: JSON.stringify({ hours: rows }) });
    await onSaved();
  }
  return (
    <section className="card">
      <h2>Weekly hours</h2>
      {rows.map((row, index) => (
        <div className="row-3" key={row.dayOfWeek}>
          <strong>{dayNames[row.dayOfWeek]}</strong>
          <label className="field">
            Open minute
            <input
              type="number"
              value={row.openMin}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, openMin: Number(event.target.value) };
                setRows(next);
              }}
            />
          </label>
          <label className="field">
            Close minute
            <input
              type="number"
              value={row.closeMin}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, closeMin: Number(event.target.value) };
                setRows(next);
              }}
            />
          </label>
        </div>
      ))}
      <button className="btn slim" type="button" onClick={() => save()}>
        Save hours
      </button>
    </section>
  );
}

function BlockedEditor({ blocked, onSaved }: { blocked: { date: string; reason: string | null }[]; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState("");
  return (
    <section className="card">
      <h2>Blocked days</h2>
      <ul>
        {blocked.map((row) => (
          <li key={row.date}>
            {row.date} {row.reason}
            <button
              className="link"
              onClick={async () => {
                await clientSend(`/admin/blocked/${row.date}`, { method: "DELETE" });
                await onSaved();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await clientSend("/admin/blocked", { method: "POST", body: JSON.stringify({ date }) });
          setDate("");
          await onSaved();
        }}
      >
        <label className="field">
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <button className="btn slim" type="submit">
          Block date
        </button>
      </form>
    </section>
  );
}
