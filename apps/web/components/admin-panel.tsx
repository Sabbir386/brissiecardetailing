"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clientSend } from "@/lib/api";
import { formatPhoneDisplay, money, vehicleLabel } from "@/lib/format";
import type { Booking, Service } from "@/lib/types";

type Tab = "today" | "jobs" | "clients" | "inbox" | "menu" | "hours" | "shop" | "settings";
type JobFilter = "all" | "today" | "upcoming" | "due" | "done" | "cancelled";
const tabIds: Tab[] = ["today", "jobs", "clients", "inbox", "menu", "hours", "shop", "settings"];

type AdminBooking = Booking;

type Overview = {
  business: {
    name: string;
    phone: string;
    phoneTel: string;
    locationLine: string;
    instagramUrl: string | null;
    facebookUrl: string | null;
    cancellationPolicy: string;
    taxRateBps: number;
  };
  services: (Service & { categoryName: string })[];
  hours: { dayOfWeek: number; openMin: number; closeMin: number; closed: boolean }[];
  blocked: { date: string; reason: string | null }[];
  bookings: AdminBooking[];
  customers: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string;
    bookingCount: number;
    lastVisit: string | null;
  }[];
  messages: { id: string; name: string; phone: string; message: string; read: boolean; createdAt: string }[];
  stats: {
    todayDate: string;
    today: number;
    upcoming: number;
    remainingDueCents: number;
    unreadMessages: number;
    completedThisWeek: number;
  };
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const tabs: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "jobs", label: "Jobs" },
  { id: "clients", label: "Clients" },
  { id: "inbox", label: "Inbox" },
  { id: "menu", label: "Menu" },
  { id: "hours", label: "Hours" },
  { id: "shop", label: "Shop" },
  { id: "settings", label: "Settings" },
];

function asTab(value: string | null): Tab {
  return tabIds.includes(value as Tab) ? (value as Tab) : "today";
}

function notifyAdminSession() {
  window.dispatchEvent(new Event("brissie-admin"));
}

export function AdminPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = asTab(searchParams.get("tab"));
  const [admin, setAdmin] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  function setTab(next: Tab) {
    router.replace(next === "today" ? "/admin" : `/admin?tab=${next}`, { scroll: false });
  }

  async function load() {
    const me = await clientSend<{ admin: { email: string } | null }>("/admin/me");
    setAdmin(me.admin?.email ?? null);
    if (me.admin) setOverview(await clientSend<Overview>("/admin/overview"));
    notifyAdminSession();
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      await clientSend("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await clientSend("/admin/logout", { method: "POST" });
    setAdmin(null);
    setOverview(null);
    notifyAdminSession();
  }

  if (!mounted) return <div className="page shop-page">Loading the website desk…</div>;

  if (!admin) {
    return (
      <form className="shop-login" onSubmit={login}>
        <p className="shop-kicker">Website admin</p>
        <h1>Sign in to brissiecardetailing</h1>
        <p className="shop-login-copy">
          Use your admin email and password to manage bookings, the service menu, hours, and customer messages.
        </p>
        <label className="field">
          Email
          <input name="email" type="email" defaultValue="admin@brissiecardetailing.local" autoComplete="username" required />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn next-cta" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    );
  }

  if (!overview) return <div className="page shop-page">Loading the website desk…</div>;

  const selected = overview.bookings.find((booking) => booking.id === selectedId) || null;

  return (
    <div className="page shop-page">
      <header className="shop-top">
        <div>
          <p className="shop-kicker">Website admin</p>
          <h1>Today’s work</h1>
          <p className="shop-signed">{admin}</p>
        </div>
        <button className="btn slim secondary shop-signout" type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section className="shop-stats" aria-label="Shop snapshot">
        <Stat label="Today" value={String(overview.stats.today)} hint="jobs on the book" />
        <Stat label="Upcoming" value={String(overview.stats.upcoming)} hint="confirmed times" />
        <Stat label="Still due" value={money(overview.stats.remainingDueCents)} hint="collect in person" />
        <Stat label="Inbox" value={String(overview.stats.unreadMessages)} hint="new texts" />
      </section>

      <nav className="shop-tabs" aria-label="Shop sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "shop-tab on" : "shop-tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "inbox" && overview.stats.unreadMessages ? (
              <span className="shop-tab-count">{overview.stats.unreadMessages}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {error ? <p className="error">{error}</p> : null}

      {tab === "today" ? (
        <TodayBoard bookings={overview.bookings} today={overview.stats.todayDate} onOpen={setSelectedId} />
      ) : null}
      {tab === "jobs" ? (
        <JobsBoard bookings={overview.bookings} today={overview.stats.todayDate} onOpen={setSelectedId} />
      ) : null}
      {tab === "clients" ? (
        <ClientsBoard
          customers={overview.customers}
          bookings={overview.bookings}
          onOpen={setSelectedId}
        />
      ) : null}
      {tab === "inbox" ? <InboxBoard messages={overview.messages} onSaved={load} /> : null}
      {tab === "menu" ? <MenuBoard services={overview.services} onSaved={load} /> : null}
      {tab === "hours" ? (
        <div className="shop-stack">
          <HoursEditor hours={overview.hours} onSaved={load} />
          <BlockedEditor blocked={overview.blocked} onSaved={load} />
        </div>
      ) : null}
      {tab === "shop" ? <ShopEditor business={overview.business} onSaved={load} /> : null}
      {tab === "settings" ? <AccountSettings email={admin} onSaved={load} /> : null}

      {selected ? (
        <JobSheet
          booking={selected}
          onClose={() => setSelectedId(null)}
          onChanged={async () => {
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="shop-stat">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function TodayBoard({
  bookings,
  today,
  onOpen,
}: {
  bookings: AdminBooking[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const rows = bookings
    .filter((booking) => booking.date === today && booking.status !== "cancelled")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  if (!rows.length) {
    return (
      <div className="shop-empty">
        <h2>No jobs today</h2>
        <p>New bookings will land here with the customer, time, and remaining balance.</p>
      </div>
    );
  }
  return (
    <div className="shop-job-list">
      {rows.map((booking) => (
        <JobCard key={booking.id} booking={booking} onOpen={onOpen} />
      ))}
    </div>
  );
}

function JobsBoard({
  bookings,
  today,
  onOpen,
}: {
  bookings: AdminBooking[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<JobFilter>("all");
  const rows = useMemo(() => {
    const now = Date.now();
    const needle = query.trim().toLowerCase();
    return bookings
      .filter((booking) => {
        if (filter === "today") return booking.date === today && booking.status !== "cancelled";
        if (filter === "upcoming") return booking.status === "confirmed" && new Date(booking.endAt).getTime() >= now;
        if (filter === "due") return booking.status === "confirmed" && !booking.balanceCollected && (booking.balanceCents || 0) > 0;
        if (filter === "done") return booking.status === "completed";
        if (filter === "cancelled") return booking.status === "cancelled";
        return true;
      })
      .filter((booking) => {
        if (!needle) return true;
        const hay = `${customerName(booking)} ${booking.customer.phone} ${booking.customer.email || ""} ${booking.items.map((item) => item.serviceName).join(" ")} ${booking.address}`.toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [bookings, filter, query, today]);

  return (
    <div className="shop-stack">
      <div className="shop-toolbar">
        <label className="shop-search">
          <span className="sr-only">Search jobs</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, or service" />
        </label>
        <div className="shop-filters">
          {(
            [
              ["all", "All"],
              ["today", "Today"],
              ["upcoming", "Upcoming"],
              ["due", "Due"],
              ["done", "Done"],
              ["cancelled", "Cancelled"],
            ] as [JobFilter, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? "shop-chip on" : "shop-chip"} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="shop-job-list">
          {rows.map((booking) => (
            <JobCard key={booking.id} booking={booking} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="shop-empty">
          <h2>No matching jobs</h2>
          <p>Try another filter or search the customer’s name or number.</p>
        </div>
      )}
    </div>
  );
}

function JobCard({ booking, onOpen }: { booking: AdminBooking; onOpen: (id: string) => void }) {
  const due = remainingDue(booking);
  return (
    <button type="button" className="shop-job" onClick={() => onOpen(booking.id)}>
      <div className="shop-job-when">
        <strong>{booking.timeLabel}</strong>
        <span>{booking.dayLabel}</span>
      </div>
      <div className="shop-job-body">
        <p className="shop-job-name">{customerName(booking)}</p>
        <p>{booking.items.map((item) => item.serviceName).join(" · ")}</p>
        <p className="shop-job-meta">{formatPhoneDisplay(booking.customer.phone)}</p>
      </div>
      <div className="shop-job-side">
        <StatusPill booking={booking} />
        <span className={due ? "shop-due" : "shop-paid"}>{due ? `${money(due)} due` : "Balance clear"}</span>
      </div>
    </button>
  );
}

function JobSheet({
  booking,
  onClose,
  onChanged,
}: {
  booking: AdminBooking;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState(booking.shopNote || "");
  const [cancelReason, setCancelReason] = useState(booking.cancelReason || "");
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const due = remainingDue(booking);

  useEffect(() => {
    setNote(booking.shopNote || "");
    setCancelReason(booking.cancelReason || "");
    setCancelling(false);
    setMessage("");
  }, [booking.id, booking.shopNote, booking.cancelReason]);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setMessage("");
    try {
      await clientSend(`/admin/bookings/${booking.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await onChanged();
      setMessage("Saved.");
      if (body.status === "cancelled") onClose();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not update this job.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="shop-sheet" role="dialog" aria-modal="true" aria-label="Appointment">
      <button className="shop-sheet-dim" aria-label="Close" type="button" onClick={onClose} />
      <div className="shop-sheet-card">
        <header className="shop-sheet-head">
          <div>
            <StatusPill booking={booking} />
            <h2>{customerName(booking)}</h2>
            <p>{booking.dayLabel} · {booking.timeLabel}</p>
          </div>
          <button type="button" className="shop-sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <ul className="shop-sheet-services">
          {booking.items.map((item) => (
            <li key={`${item.serviceName}-${item.optionName}`}>
              <strong>{item.serviceName}</strong>
              <span>{vehicleLabel(item.optionName)}</span>
            </li>
          ))}
        </ul>

        <div className="shop-contact">
          <a href={`tel:${booking.customer.phone}`}>Call {formatPhoneDisplay(booking.customer.phone)}</a>
          {booking.customer.email ? <a href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a> : null}
          {booking.address ? (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.address)}`} target="_blank" rel="noreferrer">
              {booking.address}
            </a>
          ) : null}
        </div>

        <div className="shop-money">
          <p>
            Deposit {booking.devPayment ? "(test)" : "recorded"} <b>{money(booking.depositCents)}</b>
          </p>
          <p>
            Remaining <b>{booking.balanceCents === null ? "Quoted on site" : money(booking.balanceCents)}</b>
          </p>
          <p>
            Total <b>{booking.priceOnRequest ? "Quoted" : money(booking.totalCents)}</b>
          </p>
          <p className={booking.balanceCollected ? "shop-paid" : "shop-due"}>
            {booking.balanceCollected ? "Remaining collected in person" : due ? `${money(due)} still due at the job` : "No remaining balance"}
          </p>
        </div>

        {booking.note ? <p className="shop-client-note">Customer note: {booking.note}</p> : null}

        <label className="field">
          Shop note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Gate code, vehicle, what was done…" />
        </label>
        <button className="btn slim secondary" type="button" disabled={Boolean(busy)} onClick={() => patch({ shopNote: note }, "note")}>
          {busy === "note" ? "Saving…" : "Save note"}
        </button>

        {booking.status === "confirmed" ? (
          <div className="shop-actions">
            {due ? (
              <button className="btn slim" type="button" disabled={Boolean(busy)} onClick={() => patch({ balanceCollected: true, status: "completed" }, "wrap")}>
                {busy === "wrap" ? "Saving…" : "Complete & collect remaining"}
              </button>
            ) : (
              <button className="btn slim" type="button" disabled={Boolean(busy)} onClick={() => patch({ status: "completed", balanceCollected: true }, "done")}>
                {busy === "done" ? "Saving…" : "Mark job complete"}
              </button>
            )}
            {due ? (
              <button className="btn slim secondary" type="button" disabled={Boolean(busy)} onClick={() => patch({ balanceCollected: true }, "pay")}>
                {busy === "pay" ? "Saving…" : "Remaining collected"}
              </button>
            ) : null}
            {!cancelling ? (
              <button className="btn slim secondary shop-danger" type="button" onClick={() => setCancelling(true)}>
                Cancel appointment
              </button>
            ) : (
              <div className="shop-cancel">
                <label className="field">
                  Reason for the customer
                  <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Weather, car not ready…" />
                </label>
                <div className="shop-actions">
                  <button className="btn slim shop-danger-fill" type="button" disabled={Boolean(busy)} onClick={() => patch({ status: "cancelled", cancelReason }, "cancel")}>
                    {busy === "cancel" ? "Cancelling…" : "Confirm cancel"}
                  </button>
                  <button className="btn slim secondary" type="button" onClick={() => setCancelling(false)}>
                    Keep job
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {booking.status === "completed" ? (
          <div className="shop-actions">
            <button className="btn slim secondary" type="button" disabled={Boolean(busy)} onClick={() => patch({ status: "confirmed" }, "reopen")}>
              {busy === "reopen" ? "Saving…" : "Reopen as confirmed"}
            </button>
          </div>
        ) : null}

        {booking.status === "cancelled" ? (
          <div className="shop-actions">
            {booking.cancelReason ? <p className="note">Cancelled: {booking.cancelReason}</p> : null}
            <button className="btn slim" type="button" disabled={Boolean(busy)} onClick={() => patch({ status: "confirmed" }, "restore")}>
              {busy === "restore" ? "Saving…" : "Restore this time"}
            </button>
          </div>
        ) : null}

        {message ? <p className="note">{message}</p> : null}
      </div>
    </div>
  );
}

function ClientsBoard({
  customers,
  bookings,
  onOpen,
}: {
  customers: Overview["customers"];
  bookings: AdminBooking[];
  onOpen: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!customers.length) {
    return (
      <div className="shop-empty">
        <h2>No clients yet</h2>
        <p>When someone books, their name, number, and history will show here.</p>
      </div>
    );
  }
  return (
    <div className="shop-stack">
      {customers.map((customer) => {
        const jobs = bookings.filter((booking) => booking.customer.phone === customer.phone);
        const open = openId === customer.id;
        return (
          <article className="shop-client" key={customer.id}>
            <button type="button" className="shop-client-head" onClick={() => setOpenId(open ? null : customer.id)}>
              <div>
                <strong>{[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Client"}</strong>
                <p>{formatPhoneDisplay(customer.phone)}</p>
              </div>
              <span>
                {customer.bookingCount} {customer.bookingCount === 1 ? "job" : "jobs"}
              </span>
            </button>
            {open ? (
              <div className="shop-client-jobs">
                {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : null}
                <a href={`tel:${customer.phone}`}>Call</a>
                {jobs.map((booking) => (
                  <button type="button" className="shop-mini-job" key={booking.id} onClick={() => onOpen(booking.id)}>
                    <span>{booking.dayLabel}</span>
                    <span>{booking.items[0]?.serviceName}</span>
                    <StatusPill booking={booking} />
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function InboxBoard({
  messages,
  onSaved,
}: {
  messages: Overview["messages"];
  onSaved: () => Promise<void>;
}) {
  if (!messages.length) {
    return (
      <div className="shop-empty">
        <h2>Inbox is clear</h2>
        <p>Texts from the website “Text us” form will appear here so you can call them back.</p>
      </div>
    );
  }
  return (
    <div className="shop-stack">
      {messages.map((row) => (
        <article className={row.read ? "shop-msg" : "shop-msg unread"} key={row.id}>
          <header>
            <div>
              <strong>{row.name}</strong>
              <a href={`tel:${row.phone}`}>{formatPhoneDisplay(row.phone)}</a>
            </div>
            <time>{new Date(row.createdAt).toLocaleString()}</time>
          </header>
          <p>{row.message}</p>
          <button
            className="btn slim secondary"
            type="button"
            onClick={async () => {
              await clientSend(`/admin/messages/${row.id}`, { method: "PATCH", body: JSON.stringify({ read: !row.read }) });
              await onSaved();
            }}
          >
            {row.read ? "Mark unread" : "Mark read"}
          </button>
        </article>
      ))}
    </div>
  );
}

function MenuBoard({
  services,
  onSaved,
}: {
  services: (Service & { categoryName: string })[];
  onSaved: () => Promise<void>;
}) {
  const groups = services.reduce<Record<string, (Service & { categoryName: string })[]>>((acc, service) => {
    const key = service.categoryName || "Other";
    acc[key] = acc[key] ? [...acc[key], service] : [service];
    return acc;
  }, {});
  return (
    <div className="shop-stack">
      <div className="shop-empty">
        <h2>Website services</h2>
        <p>This is the same list customers see: Standard Detail, Full detail, paint enhancement, Off-road Package, and Other. Change a name, photo, price, or description here and it updates on the website.</p>
      </div>
      {Object.entries(groups).map(([category, rows]) => (
        <section className="shop-stack" key={category}>
          <h2 className="shop-menu-cat">{category}</h2>
          {rows.map((service) => (
            <ServiceEditor key={service.id} service={service} onSaved={onSaved} />
          ))}
        </section>
      ))}
    </div>
  );
}

function ServiceEditor({ service, onSaved }: { service: Service & { categoryName: string }; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(service.name);
  const [summary, setSummary] = useState(service.summary);
  const [photo, setPhoto] = useState(service.photo);
  const [deposit, setDeposit] = useState(service.depositCents / 100);
  const [isAddon, setAddon] = useState(service.isAddon);
  const [dropoff, setDropoff] = useState(service.requiresDropoff);
  const [options, setOptions] = useState(service.options);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setMessage("");
    setBusy(true);
    try {
      await clientSend(`/admin/services/${service.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          summary,
          photo: photo.trim(),
          depositCents: Math.round(deposit * 100),
          isAddon,
          requiresDropoff: dropoff,
          options: options.map((option) => ({
            id: option.id,
            name: option.name,
            priceCents: Math.round(option.priceOnRequest ? 0 : option.priceCents),
            durationMinutes: option.durationMinutes,
            priceOnRequest: option.priceOnRequest,
          })),
        }),
      });
      setMessage("Saved");
      await onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shop-card shop-service">
      <div className="shop-service-head">
        <div>
          <p className="shop-kicker">{service.categoryName}</p>
          <h2>{name || service.name}</h2>
          <p className="note">{service.priceLine}</p>
        </div>
        {photo ? <img className="shop-service-photo" src={photo} alt="" /> : null}
      </div>
      <label className="field">
        Name on the website
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        Short description
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} />
      </label>
      <label className="field">
        Photo
        <input value={photo} onChange={(event) => setPhoto(event.target.value)} />
      </label>
      <div className="shop-row">
        <label className="field">
          Deposit (dollars)
          <input type="number" min={0} step="1" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={isAddon} onChange={(event) => setAddon(event.target.checked)} /> Add-on only
        </label>
        <label className="check">
          <input type="checkbox" checked={dropoff} onChange={(event) => setDropoff(event.target.checked)} /> Drop-off
        </label>
      </div>
      {options.map((option, index) => (
        <div className="shop-option" key={option.id}>
          <label className="field">
            Vehicle / option
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
            Price (dollars)
            <input
              type="number"
              min={0}
              value={option.priceOnRequest ? 0 : option.priceCents / 100}
              disabled={option.priceOnRequest}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, priceCents: Math.round(Number(event.target.value) * 100) };
                setOptions(next);
              }}
            />
          </label>
          <label className="field">
            Minutes
            <input
              type="number"
              min={15}
              value={option.durationMinutes}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, durationMinutes: Number(event.target.value) };
                setOptions(next);
              }}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={option.priceOnRequest}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, priceOnRequest: event.target.checked };
                setOptions(next);
              }}
            />
            Quote on site
          </label>
        </div>
      ))}
      <button className="btn slim" type="button" disabled={busy} onClick={() => save()}>
        {busy ? "Saving…" : "Save service"}
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
  const [message, setMessage] = useState("");
  useEffect(() => {
    setRows(hours);
  }, [hours]);
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((day) => rows.find((row) => row.dayOfWeek === day)).filter(Boolean) as typeof rows;

  async function save() {
    setMessage("");
    try {
      await clientSend("/admin/hours", { method: "PUT", body: JSON.stringify({ hours: rows }) });
      setMessage("Hours saved");
      await onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save hours.");
    }
  }

  return (
    <section className="shop-card">
      <h2>Weekly hours</h2>
      <p className="note">Closed days will not offer booking times. Open and close use 24-hour time.</p>
      {ordered.map((row) => {
        const index = rows.findIndex((item) => item.dayOfWeek === row.dayOfWeek);
        return (
          <div className="shop-hours-row" key={row.dayOfWeek}>
            <strong>{dayNames[row.dayOfWeek]}</strong>
            <label className="check">
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, closed: event.target.checked };
                  setRows(next);
                }}
              />
              Closed
            </label>
            <label className="field">
              Open
              <input
                type="time"
                disabled={row.closed}
                value={minutesToClock(row.openMin)}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, openMin: clockToMinutes(event.target.value) };
                  setRows(next);
                }}
              />
            </label>
            <label className="field">
              Close
              <input
                type="time"
                disabled={row.closed}
                value={minutesToClock(row.closeMin)}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, closeMin: clockToMinutes(event.target.value) };
                  setRows(next);
                }}
              />
            </label>
          </div>
        );
      })}
      <button className="btn slim" type="button" onClick={() => save()}>
        Save hours
      </button>
      {message ? <p className="note">{message}</p> : null}
    </section>
  );
}

function BlockedEditor({ blocked, onSaved }: { blocked: { date: string; reason: string | null }[]; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section className="shop-card">
      <h2>Blocked days</h2>
      <p className="note">Use this for holidays or days you cannot take mobile jobs.</p>
      <ul className="shop-blocked">
        {blocked.map((row) => (
          <li key={row.date}>
            <span>
              {row.date}
              {row.reason ? ` · ${row.reason}` : ""}
            </span>
            <button
              className="link"
              type="button"
              onClick={async () => {
                await clientSend(`/admin/blocked/${row.date}`, { method: "DELETE" });
                await onSaved();
              }}
            >
              Open again
            </button>
          </li>
        ))}
      </ul>
      <form
        className="shop-block-form"
        onSubmit={async (event) => {
          event.preventDefault();
          await clientSend("/admin/blocked", { method: "POST", body: JSON.stringify({ date, reason: reason.trim() || undefined }) });
          setDate("");
          setReason("");
          await onSaved();
        }}
      >
        <label className="field">
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="field">
          Reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Holiday, fully booked…" />
        </label>
        <button className="btn slim" type="submit">
          Block date
        </button>
      </form>
    </section>
  );
}

function ShopEditor({ business, onSaved }: { business: Overview["business"]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(business);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(business);
  }, [business]);

  function set<K extends keyof Overview["business"]>(key: K, value: Overview["business"][K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await clientSend("/admin/business", { method: "PUT", body: JSON.stringify(form) });
      setMessage("Shop details saved");
      await onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save shop details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shop-card">
      <h2>Shop details</h2>
      <label className="field">
        Public name
        <input value={form.name} onChange={(event) => set("name", event.target.value)} />
      </label>
      <div className="shop-row">
        <label className="field">
          Phone shown
          <input value={form.phone} onChange={(event) => set("phone", event.target.value)} />
        </label>
        <label className="field">
          Call link
          <input value={form.phoneTel} onChange={(event) => set("phoneTel", event.target.value)} />
        </label>
      </div>
      <label className="field">
        Location line
        <input value={form.locationLine} onChange={(event) => set("locationLine", event.target.value)} />
      </label>
      <div className="shop-row">
        <label className="field">
          Instagram
          <input value={form.instagramUrl || ""} onChange={(event) => set("instagramUrl", event.target.value)} />
        </label>
        <label className="field">
          Facebook
          <input value={form.facebookUrl || ""} onChange={(event) => set("facebookUrl", event.target.value)} />
        </label>
      </div>
      <label className="field">
        Cancellation policy
        <textarea value={form.cancellationPolicy} onChange={(event) => set("cancellationPolicy", event.target.value)} rows={5} />
      </label>
      <label className="field">
        Tax %
        <input type="number" min={0} max={30} step="0.1" value={form.taxRateBps / 100} onChange={(event) => set("taxRateBps", Math.round(Number(event.target.value) * 100))} />
      </label>
      <button className="btn slim" type="button" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save shop"}
      </button>
      {message ? <p className="note">{message}</p> : null}
    </section>
  );
}

function AccountSettings({ email, onSaved }: { email: string; onSaved: () => Promise<void> }) {
  const [nextEmail, setNextEmail] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNextEmail(email);
  }, [email]);

  async function save() {
    setMessage("");
    if (newPassword && newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await clientSend("/admin/account", {
        method: "PUT",
        body: JSON.stringify({
          email: nextEmail,
          currentPassword,
          newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Admin email and password saved.");
      await onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not update account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shop-card">
      <h2>Admin settings</h2>
      <p className="note">Change the email and password used to sign in to this website desk. Current password is required.</p>
      <label className="field">
        Admin email
        <input type="email" value={nextEmail} autoComplete="username" onChange={(event) => setNextEmail(event.target.value)} />
      </label>
      <label className="field">
        Current password
        <input type="password" value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} />
      </label>
      <label className="field">
        New password
        <input type="password" value={newPassword} autoComplete="new-password" placeholder="Leave blank to keep the current password" onChange={(event) => setNewPassword(event.target.value)} />
      </label>
      <label className="field">
        Confirm new password
        <input type="password" value={confirmPassword} autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} />
      </label>
      <button className="btn slim" type="button" disabled={busy || !currentPassword} onClick={save}>
        {busy ? "Saving…" : "Save account"}
      </button>
      {message ? <p className="note">{message}</p> : null}
    </section>
  );
}

function StatusPill({ booking }: { booking: AdminBooking }) {
  const label =
    booking.status === "cancelled"
      ? "Cancelled"
      : booking.status === "completed"
        ? "Completed"
        : remainingDue(booking)
          ? "Due at job"
          : "Confirmed";
  const tone = booking.status === "cancelled" ? "cancelled" : booking.status === "completed" ? "done" : remainingDue(booking) ? "due" : "ok";
  return <span className={`shop-pill ${tone}`}>{label}</span>;
}

function customerName(booking: AdminBooking) {
  const name = [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" ");
  return name || formatPhoneDisplay(booking.customer.phone);
}

function remainingDue(booking: AdminBooking) {
  if (booking.balanceCollected || booking.status === "cancelled") return 0;
  return booking.balanceCents || 0;
}

function minutesToClock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function clockToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
