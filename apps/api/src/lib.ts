import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const ZONE = "America/Los_Angeles";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("hex");
}

export function roundUp30(minutes: number) {
  return Math.max(30, Math.ceil(minutes / 30) * 30);
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours} hr ${mins} min`;
  if (hours) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${mins} min`;
}

export type PricedItem = {
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  optionId: string;
  optionName: string;
  priceCents: number;
  durationMinutes: number;
  isAddon: boolean;
  requiresDropoff: boolean;
  priceOnRequest: boolean;
  depositCents: number;
  photo: string;
};

export type Quote = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number | null;
  durationMinutes: number;
  priceOnRequest: boolean;
};

type OptionRow = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  priceOnRequest: boolean;
  service: {
    id: string;
    slug: string;
    name: string;
    depositCents: number;
    isAddon: boolean;
    requiresDropoff: boolean;
    photo: string;
  };
};

export function quoteItems(items: PricedItem[], taxRateBps: number): Quote {
  if (!items.some((item) => !item.isAddon)) {
    throw new HttpError(400, "Add a main service before continuing. Add-ons cannot be booked alone.");
  }
  const priceOnRequest = items.some((item) => item.priceOnRequest);
  const subtotalCents = items.reduce((sum, item) => sum + (item.priceOnRequest ? 0 : item.priceCents), 0);
  const taxCents = priceOnRequest ? 0 : Math.round((subtotalCents * taxRateBps) / 10000);
  const totalCents = subtotalCents + taxCents;
  const depositRaw = Math.max(...items.map((item) => item.depositCents));
  const depositCents = priceOnRequest ? depositRaw : Math.min(depositRaw, totalCents);
  const balanceCents = priceOnRequest ? null : totalCents - depositCents;
  const durationMinutes = roundUp30(items.reduce((sum, item) => sum + item.durationMinutes, 0));
  return { subtotalCents, taxCents, totalCents, depositCents, balanceCents, durationMinutes, priceOnRequest };
}

export async function priceSelection(
  selection: { serviceId: string; optionId: string }[],
): Promise<{ items: PricedItem[]; quote: Quote }> {
  if (!selection.length) throw new HttpError(400, "Choose at least one service.");
  const options = await prisma.serviceOption.findMany({
    where: { id: { in: selection.map((item) => item.optionId) } },
    include: {
      service: {
        select: {
          id: true,
          slug: true,
          name: true,
          depositCents: true,
          isAddon: true,
          requiresDropoff: true,
          photo: true,
        },
      },
    },
  });
  const byId = new Map(options.map((option) => [option.id, option as OptionRow]));
  const items: PricedItem[] = selection.map((picked) => {
    const option = byId.get(picked.optionId);
    if (!option || option.service.id !== picked.serviceId) {
      throw new HttpError(400, "A selected service option is no longer available.");
    }
    return {
      serviceId: option.service.id,
      serviceSlug: option.service.slug,
      serviceName: option.service.name,
      optionId: option.id,
      optionName: option.name,
      priceCents: option.priceCents,
      durationMinutes: option.durationMinutes,
      isAddon: option.service.isAddon,
      requiresDropoff: option.service.requiresDropoff,
      priceOnRequest: option.priceOnRequest,
      depositCents: option.service.depositCents,
      photo: option.service.photo,
    };
  });
  const business = await prisma.business.findUniqueOrThrow({ where: { id: "main" } });
  return { items, quote: quoteItems(items, business.taxRateBps) };
}

export function serviceMeta(options: { priceCents: number; durationMinutes: number; priceOnRequest: boolean }[]) {
  const durations = options.map((option) => option.durationMinutes);
  const minDuration = Math.min(...durations);
  const sameDuration = durations.every((value) => value === minDuration);
  const prices = options.map((option) => option.priceCents);
  const onRequest = options.some((option) => option.priceOnRequest);
  const samePrice = prices.every((value) => value === prices[0]);
  let priceLine: string;
  if (onRequest) priceLine = `Price varies · ${formatDuration(minDuration)}+`;
  else if (samePrice) priceLine = `US${formatUsd(prices[0])} · ${formatDuration(minDuration)}`;
  else if (sameDuration) {
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    priceLine = `${formatUsd(low)} – ${formatUsd(high)} · ${formatDuration(minDuration)}`;
  } else priceLine = `Price varies · ${formatDuration(minDuration)}+`;
  return { priceLine, durationMinutes: minDuration };
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function jsDay(dt: DateTime) {
  return dt.weekday % 7;
}

export async function businessPayload() {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: "main" } });
  const hours = await prisma.weeklyHour.findMany({ orderBy: { dayOfWeek: "asc" } });
  const now = DateTime.now().setZone(ZONE);
  const today = hours.find((hour) => hour.dayOfWeek === jsDay(now));
  let openUntilLabel = "Closed today";
  if (today && !today.closed) {
    const close = now.startOf("day").plus({ minutes: today.closeMin });
    const open = now.startOf("day").plus({ minutes: today.openMin });
    if (now < open) openUntilLabel = `Opens at ${open.toFormat("HH:mm")}`;
    else if (now < close) openUntilLabel = `Open until ${close.toFormat("HH:mm")}`;
    else openUntilLabel = "Closed for today";
  }
  return {
    ...business,
    openUntilLabel,
    hours: hours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      label: dayNames[hour.dayOfWeek],
      closed: hour.closed,
      open: minutesToClock(hour.openMin),
      close: minutesToClock(hour.closeMin),
    })),
  };
}

export function minutesToClock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function clockToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new HttpError(400, "Hours must look like 07:00.");
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < 0 || minutes > 24 * 60) throw new HttpError(400, "Hours are out of range.");
  return minutes;
}

export async function releaseExpiredHolds() {
  await prisma.hold.updateMany({
    where: { released: false, expiresAt: { lt: new Date() } },
    data: { released: true },
  });
}

export async function conflicting(start: Date, end: Date, ignoreHoldId?: string) {
  const booking = await prisma.booking.findFirst({
    where: {
      status: "confirmed",
      startAt: { lt: end },
      endAt: { gt: start },
    },
    select: { id: true },
  });
  if (booking) return true;
  const hold = await prisma.hold.findFirst({
    where: {
      released: false,
      expiresAt: { gt: new Date() },
      id: ignoreHoldId ? { not: ignoreHoldId } : undefined,
      startAt: { lt: end },
      endAt: { gt: start },
    },
    select: { id: true },
  });
  return Boolean(hold);
}

export async function availability(durationMinutes: number) {
  await releaseExpiredHolds();
  const duration = roundUp30(durationMinutes);
  const now = DateTime.now().setZone(ZONE);
  const hours = await prisma.weeklyHour.findMany();
  const blocked = new Set((await prisma.blockedDate.findMany()).map((row) => row.date));
  const horizonStart = now.startOf("day");
  const horizonEnd = horizonStart.plus({ days: 45 }).endOf("day");
  const [bookings, holds] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "confirmed", startAt: { lt: horizonEnd.toJSDate() }, endAt: { gt: now.toJSDate() } },
      select: { startAt: true, endAt: true },
    }),
    prisma.hold.findMany({
      where: {
        released: false,
        expiresAt: { gt: new Date() },
        startAt: { lt: horizonEnd.toJSDate() },
        endAt: { gt: now.toJSDate() },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);
  const busy = [...bookings, ...holds];
  const days = [];
  for (let i = 0; i < 45; i++) {
    const day = horizonStart.plus({ days: i });
    const date = day.toISODate()!;
    const rule = hours.find((hour) => hour.dayOfWeek === jsDay(day));
    const slots: string[] = [];
    if (rule && !rule.closed && !blocked.has(date)) {
      for (let minute = rule.openMin; minute + duration <= rule.closeMin; minute += 30) {
        const start = day.plus({ minutes: minute });
        const end = start.plus({ minutes: duration });
        if (start <= now) continue;
        const startDate = start.toJSDate();
        const endDate = end.toJSDate();
        const overlap = busy.some((event) => startDate < event.endAt && endDate > event.startAt);
        if (!overlap) slots.push(start.toFormat("HH:mm"));
      }
    }
    days.push({ date, slots });
  }
  return { timezone: ZONE, durationMinutes: duration, days };
}

export async function sessionFromToken(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { customer: true, admin: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function createSession(kind: "customer" | "admin", id: string) {
  const token = randomToken();
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      kind,
      customerId: kind === "customer" ? id : null,
      adminId: kind === "admin" ? id : null,
      expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
    },
  });
  return token;
}

export function cookieHeader(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `brissie_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearCookieHeader() {
  return "brissie_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function wallTime(date: string, time: string) {
  const start = DateTime.fromISO(`${date}T${time}`, { zone: ZONE });
  if (!start.isValid) throw new HttpError(400, "Choose a valid date and time.");
  return start;
}

export async function assertSlotOpen(start: DateTime, durationMinutes: number, ignoreHoldId?: string) {
  const hours = await prisma.weeklyHour.findUnique({ where: { dayOfWeek: jsDay(start) } });
  if (!hours || hours.closed) throw new HttpError(400, "The shop is closed that day.");
  const blocked = await prisma.blockedDate.findUnique({ where: { date: start.toISODate()! } });
  if (blocked) throw new HttpError(400, "That date is unavailable.");
  const minute = start.hour * 60 + start.minute;
  if (minute < hours.openMin || minute + durationMinutes > hours.closeMin) {
    throw new HttpError(400, "That time is outside working hours.");
  }
  if (start <= DateTime.now().setZone(ZONE)) throw new HttpError(400, "That time has already passed.");
  const end = start.plus({ minutes: durationMinutes });
  if (await conflicting(start.toJSDate(), end.toJSDate(), ignoreHoldId)) {
    throw new HttpError(409, "That time was just taken. Choose another opening.");
  }
  return end;
}

export type Tx = Prisma.TransactionClient;
