"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clientSend } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { CookieFooter } from "@/components/shell";
import { vehicleLabel } from "@/lib/format";
import type { Availability, Hold } from "@/lib/types";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const BUSINESS_ZONE = "America/Los_Angeles";

export function CalendarBook() {
  const cart = useCart();
  const router = useRouter();
  const [data, setData] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [viewerZone, setViewerZone] = useState(BUSINESS_ZONE);
  const [busy, setBusy] = useState("");
  const emptyRef = useRef<HTMLElement | null>(null);

  const rawDuration = cart.items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const businessZone = data?.timezone || BUSINESS_ZONE;

  useEffect(() => {
    setViewerZone(Intl.DateTimeFormat().resolvedOptions().timeZone || BUSINESS_ZONE);
  }, []);

  useEffect(() => {
    if (!cart.ready || !cart.hasMain) return;
    clientSend<Availability>(`/availability?duration=${rawDuration}`)
      .then((result) => {
        setData(result);
        const today = result.days[0]?.date || "";
        setSelected(today);
        if (today) setCursor(isoToMonth(today));
      })
      .catch((reason: Error) => setError(reason.message));
  }, [cart.ready, cart.hasMain, rawDuration]);

  const todayIso = data?.days[0]?.date || "";
  const openDays = useMemo(() => new Map(data?.days.map((day) => [day.date, day.slots]) ?? []), [data]);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const monthCells = useMemo(() => buildMonth(cursor, openDays), [cursor, openDays]);
  const weekCells = useMemo(() => buildWeek(selected || todayIso, openDays), [selected, todayIso, openDays]);
  const daySlots = openDays.get(selected) || [];
  const nextOpen = useMemo(() => {
    if (!data) return null;
    return data.days.find((item) => item.slots.length > 0 && (!selected || item.date > selected)) ?? null;
  }, [data, selected]);
  const shownSlots = useMemo(
    () =>
      daySlots.map((slot) => ({
        business: slot,
        display: displaySlot(selected, slot, businessZone, viewerZone),
      })),
    [daySlots, selected, businessZone, viewerZone],
  );
  const morning = shownSlots.filter((slot) => slot.display < "12:00");
  const afternoon = shownSlots.filter((slot) => slot.display >= "12:00" && slot.display < "17:00");
  const evening = shownSlots.filter((slot) => slot.display >= "17:00");
  const hasSlots = shownSlots.length > 0;
  const prevMonthBlocked = Boolean(todayIso && monthEnd(shiftMonth(cursor, -1)) < todayIso);
  const prevWeekBlocked = Boolean(todayIso && weekCells[0] && shiftIso(weekCells[0].date, -1) < todayIso);

  useEffect(() => {
    if (!data || hasSlots) return;
    const node = emptyRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const hidden = rect.top < 96 || rect.bottom > window.innerHeight - 16;
    if (hidden) node.scrollIntoView({ block: "center", behavior: "auto" });
  }, [data, hasSlots, selected]);

  function pickDate(date: string, expand = false) {
    if (todayIso && date < todayIso) return;
    setSelected(date);
    setCursor(isoToMonth(date));
    if (expand) setCalOpen(true);
  }

  function jumpTo(date: string) {
    pickDate(date, true);
  }

  function shiftCollapsed(weeks: number) {
    const next = shiftIso(weekCells[0]?.date || selected || todayIso, weeks * 7);
    const monday = mondayOf(next);
    const firstLive = Array.from({ length: 7 }, (_, index) => shiftIso(monday, index)).find((date) => !todayIso || date >= todayIso);
    pickDate(firstLive || monday, false);
  }

  async function choose(time: string) {
    setError("");
    setBusy(time);
    try {
      const hold = await clientSend<Hold>("/holds", {
        method: "POST",
        body: JSON.stringify({
          date: selected,
          time,
          items: cart.items.map((item) => ({ serviceId: item.serviceId, optionId: item.optionId })),
        }),
      });
      router.push(`/checkout?hold=${hold.id}`);
    } catch (reason) {
      setBusy("");
      setError(reason instanceof Error ? reason.message : "That time is unavailable.");
    }
  }

  if (!cart.ready) {
    return (
      <div className="page book-page">
        <p className="book-loading">Loading your appointment…</p>
      </div>
    );
  }
  if (!cart.hasMain) {
    return (
      <div className="page">
        <h1>Add a main service first</h1>
        <p>Engine bay, headlights, and pet-hair extraction can only be added alongside a detail package.</p>
        <Link className="btn slim" href="/">
          Back to services
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page book-page">
        {error ? (
          <>
            <p className="error">{error}</p>
            <button className="btn-next-avail" type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </>
        ) : (
          <p className="book-loading">Finding the next opening…</p>
        )}
      </div>
    );
  }

  return (
    <div className="page book-page">
      <div className="book-layout">
        <main className="book-main">
          <div className={`book-cal${calOpen ? " open" : " week-only"}`}>
            <div className="month-nav">
              {calOpen ? (
                <button className="cal-nav" type="button" aria-label="Previous month" disabled={prevMonthBlocked} onClick={() => setCursor(shiftMonth(cursor, -1))}>
                  <NavArrow dir="left" />
                </button>
              ) : (
                <h1>{monthLabel}</h1>
              )}
              {calOpen ? <h1>{monthLabel}</h1> : null}
              <div className="cal-navs">
                {calOpen ? null : (
                  <button className="cal-nav" type="button" aria-label="Previous week" disabled={prevWeekBlocked} onClick={() => shiftCollapsed(-1)}>
                    <NavArrow dir="left" />
                  </button>
                )}
                <button
                  className="cal-nav"
                  type="button"
                  aria-label={calOpen ? "Next month" : "Next week"}
                  onClick={() => (calOpen ? setCursor(shiftMonth(cursor, 1)) : shiftCollapsed(1))}
                >
                  <NavArrow dir="right" />
                </button>
              </div>
            </div>

            {calOpen ? (
              <>
                <div className="week">
                  {WEEKDAYS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="days">
                  {monthCells.map((cell, index) =>
                    cell ? (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={Boolean(todayIso && cell.date < todayIso)}
                        className={dayClass(cell.date, selected, todayIso, cell.open)}
                        onClick={() => pickDate(cell.date)}
                      >
                        {cell.day}
                      </button>
                    ) : (
                      <span key={`empty-${index}`} />
                    ),
                  )}
                </div>
              </>
            ) : (
              <div className="week-strip">
                {weekCells.map((cell) => (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={Boolean(todayIso && cell.date < todayIso)}
                    className={`day-chip${cell.date === selected ? " on" : ""}${todayIso && cell.date < todayIso ? " past" : ""}${!cell.open ? " quiet" : ""}`}
                    onClick={() => pickDate(cell.date, true)}
                  >
                    <small>{cell.weekday}</small>
                    <b>{cell.day}</b>
                  </button>
                ))}
              </div>
            )}

            <button
              className="cal-fold"
              type="button"
              aria-expanded={calOpen}
              aria-label={calOpen ? "Hide calendar" : "Show calendar"}
              onClick={() => setCalOpen((value) => !value)}
            >
              <span className="summary-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>

          <p className="book-tz">
            This business is in {formatOffset(businessZone)}. Times are shown in <b>{formatOffset(viewerZone)}</b>.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <div className="book-times">
            <h2 className="book-day">{selected ? dayHeading(selected, todayIso) : "Choose a day"}</h2>
            {hasSlots ? (
              <>
                <SlotGroup title="Morning" slots={morning} busy={busy} onChoose={choose} />
                <SlotGroup title="Afternoon" slots={afternoon} busy={busy} onChoose={choose} />
                <SlotGroup title="Evening" slots={evening} busy={busy} onChoose={choose} />
              </>
            ) : (
              <section className="book-empty" ref={emptyRef}>
                <p>
                  {nextOpen ? `No availability until ${untilLabel(nextOpen.date)}.` : "No availability on this day."}
                </p>
                {nextOpen ? (
                  <button className="btn-next-avail" type="button" onClick={() => jumpTo(nextOpen.date)}>
                    Go to next available
                  </button>
                ) : null}
              </section>
            )}
          </div>
        </main>
        <BookSummary />
      </div>
      <CookieFooter />
    </div>
  );
}

function BookSummary() {
  const cart = useCart();
  return (
    <aside className="book-summary">
      <h2>Appointment summary</h2>
      <div className="book-summary-card">
        {cart.items.map((item) => (
          <div className="book-summary-row" key={item.optionId}>
            {item.photo ? <img className="book-thumb" src={item.photo} alt="" /> : null}
            <div>
              <strong>{item.serviceName}</strong>
              <span>{vehicleLabel(item.optionName)}</span>
            </div>
            <b>{item.priceOnRequest ? "Quoted" : usMoney(item.priceLabel)}</b>
            <Link className="summary-icon" href={`/services/${item.slug}`} aria-label={`Edit ${item.serviceName}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M11.4 2.6l1.9 1.9-8 8H3.4v-1.9l8-8zM10.2 3.8l1.9 1.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </aside>
  );
}

function SlotGroup({
  title,
  slots,
  busy,
  onChoose,
}: {
  title: string;
  slots: { business: string; display: string }[];
  busy: string;
  onChoose: (time: string) => void;
}) {
  return (
    <section className="slot-group">
      <h3>{title}</h3>
      {slots.length ? (
        <div className="slots">
          {slots.map((slot) => (
            <button key={slot.business} className="slot" type="button" disabled={Boolean(busy)} onClick={() => onChoose(slot.business)}>
              {slot.display}
            </button>
          ))}
        </div>
      ) : (
        <p className="slot-none">No availability</p>
      )}
    </section>
  );
}

function NavArrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {dir === "left" ? (
        <path d="M10 3.5L5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function dayClass(date: string, selected: string, todayIso: string, open: boolean) {
  return [
    "day",
    date === selected ? "on" : "",
    date === todayIso ? "today" : "",
    todayIso && date < todayIso ? "past" : "",
    open ? "has" : "quiet",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildMonth(cursor: Date, openDays: Map<string, string[]>) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: ({ date: string; day: number; open: boolean } | null)[] = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= count; day++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, open: (openDays.get(date) || []).length > 0 });
  }
  return cells;
}

function buildWeek(iso: string, openDays: Map<string, string[]>) {
  if (!iso) return [];
  const monday = mondayOf(iso);
  return WEEKDAYS.map((weekday, index) => {
    const date = shiftIso(monday, index);
    const day = Number(date.slice(8));
    return { date, day, weekday, open: (openDays.get(date) || []).length > 0 };
  });
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isoToMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthEnd(date: Date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  const pad = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - pad);
  return toIso(date);
}

function shiftIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayHeading(iso: string, todayIso: string) {
  const date = new Date(`${iso}T12:00:00`);
  const label = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  return iso === todayIso ? `Today, ${label}` : label;
}

function untilLabel(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} ${Number(iso.slice(8))} ${month}`;
}

function formatOffset(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const raw = (parts.find((part) => part.type === "timeZoneName")?.value || "GMT").replace(/^UTC/, "GMT");
  return raw.replace(/GMT([+-])0?(\d+)(?::00)?$/, (_full, sign: string, hours: string) => `GMT${sign}${Number(hours)}`);
}

function zoneOffsetMs(utcMs: number, timeZone: string) {
  const date = new Date(utcMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")) - utcMs;
}

function wallInZone(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(asUtc - zoneOffsetMs(asUtc, timeZone));
}

function displaySlot(date: string, time: string, fromZone: string, toZone: string) {
  const instant = wallInZone(date, time, fromZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: toZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour.padStart(2, "0")}:${minute}`;
}

function usMoney(label: string) {
  if (label.startsWith("US$")) return label;
  if (label.startsWith("$")) return `US${label}`;
  return label;
}
