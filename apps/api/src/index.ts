import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { DateTime } from "luxon";
import Stripe from "stripe";
import {
  HttpError,
  ZONE,
  assertSlotOpen,
  availability,
  businessPayload,
  checkPassword,
  clearCookieHeader,
  cookieHeader,
  createSession,
  formatDuration,
  formatUsd,
  hashPassword,
  parseCookie,
  priceSelection,
  prisma,
  quoteItems,
  randomToken,
  releaseExpiredHolds,
  safeEqual,
  serviceMeta,
  sessionFromToken,
  sha256,
  wallTime,
} from "./lib";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const devPayments = !stripe && process.env.ALLOW_DEV_PAYMENTS !== "false";

function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function viewer(req: express.Request) {
  return sessionFromToken(parseCookie(req.header("cookie"), "brissie_session"));
}

async function requireAdmin(req: express.Request) {
  const session = await viewer(req);
  if (!session?.admin) throw new HttpError(401, "Admin sign-in is required.");
  return session.admin;
}

function publicService(service: {
  id: string;
  name: string;
  slug: string;
  summary: string;
  paragraphs: unknown;
  bullets: unknown;
  warnings: unknown;
  photo: string;
  depositCents: number;
  isAddon: boolean;
  requiresDropoff: boolean;
  options: {
    id: string;
    name: string;
    priceCents: number;
    durationMinutes: number;
    priceOnRequest: boolean;
    sortOrder: number;
  }[];
}) {
  const options = [...service.options].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    summary: service.summary,
    paragraphs: service.paragraphs,
    bullets: service.bullets,
    warnings: service.warnings,
    photo: service.photo,
    depositCents: service.depositCents,
    depositLabel: formatUsd(service.depositCents),
    isAddon: service.isAddon,
    requiresDropoff: service.requiresDropoff,
    ...serviceMeta(options),
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      priceCents: option.priceCents,
      priceLabel: option.priceOnRequest ? "Price confirmed at the appointment" : formatUsd(option.priceCents),
      durationMinutes: option.durationMinutes,
      durationLabel: formatDuration(option.durationMinutes),
      priceOnRequest: option.priceOnRequest,
    })),
  };
}

const selectionSchema = z.object({
  items: z
    .array(z.object({ serviceId: z.string(), optionId: z.string() }))
    .min(1)
    .max(12),
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, payments: stripe ? "stripe" : devPayments ? "dev" : "off" });
});

app.get(
  "/business",
  asyncRoute(async (_req, res) => {
    res.json(await businessPayload());
  }),
);

app.get(
  "/services",
  asyncRoute(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { services: { orderBy: { sortOrder: "asc" }, include: { options: true } } },
    });
    res.json(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        services: category.services.map(publicService),
      })),
    );
  }),
);

app.get(
  "/services/:slug",
  asyncRoute(async (req, res) => {
    const service = await prisma.service.findUnique({
      where: { slug: String(req.params.slug) },
      include: { options: true, category: true },
    });
    if (!service) throw new HttpError(404, "Service not found.");
    res.json({ ...publicService(service), category: { name: service.category.name, slug: service.category.slug } });
  }),
);

app.get(
  "/availability",
  asyncRoute(async (req, res) => {
    const duration = Number(req.query.duration);
    if (!Number.isFinite(duration) || duration < 30 || duration > 24 * 60) {
      throw new HttpError(400, "Duration is required.");
    }
    res.json(await availability(duration));
  }),
);

app.post(
  "/holds",
  asyncRoute(async (req, res) => {
    const body = selectionSchema.extend({ date: z.string(), time: z.string() }).parse(req.body);
    await releaseExpiredHolds();
    const priced = await priceSelection(body.items);
    const start = wallTime(body.date, body.time);
    const end = await assertSlotOpen(start, priced.quote.durationMinutes);
    const hold = await prisma.$transaction(
      async (tx) => {
        const clash = await tx.booking.findFirst({
          where: { status: "confirmed", startAt: { lt: end.toJSDate() }, endAt: { gt: start.toJSDate() } },
        });
        const held = await tx.hold.findFirst({
          where: {
            released: false,
            expiresAt: { gt: new Date() },
            startAt: { lt: end.toJSDate() },
            endAt: { gt: start.toJSDate() },
          },
        });
        if (clash || held) throw new HttpError(409, "That time was just taken. Choose another opening.");
        return tx.hold.create({
          data: {
            startAt: start.toJSDate(),
            endAt: end.toJSDate(),
            expiresAt: DateTime.now().plus({ minutes: 10 }).toJSDate(),
            items: priced.items,
            quote: priced.quote,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    res.status(201).json(presentHold(hold));
  }),
);

app.get(
  "/holds/:id",
  asyncRoute(async (req, res) => {
    const hold = await prisma.hold.findUnique({ where: { id: String(req.params.id) } });
    if (!hold || hold.released || hold.expiresAt < new Date()) throw new HttpError(410, "This hold has expired.");
    res.json(presentHold(hold));
  }),
);

app.post(
  "/payments/intent",
  asyncRoute(async (req, res) => {
    const body = z.object({ holdId: z.string(), saveCard: z.boolean().optional() }).parse(req.body);
    const hold = await liveHold(body.holdId);
    const quote = hold.quote as QuoteJson;
    if (!stripe) {
      res.json({ mode: "dev", depositCents: quote.depositCents });
      return;
    }
    const intent = await stripe.paymentIntents.create({
      amount: quote.depositCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      setup_future_usage: body.saveCard ? "off_session" : undefined,
      metadata: { holdId: hold.id },
    });
    res.json({ mode: "stripe", clientSecret: intent.client_secret, depositCents: quote.depositCents });
  }),
);

const bookingSchema = z.object({
  holdId: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(8).max(24),
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(40),
  zip: z.string().trim().min(3).max(12),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  policyAccepted: z.literal(true),
  saveCard: z.boolean().optional(),
  paymentIntentId: z.string().optional(),
  devPayment: z.boolean().optional(),
});

app.post(
  "/bookings",
  asyncRoute(async (req, res) => {
    const body = bookingSchema.parse(req.body);
    const hold = await liveHold(body.holdId);
    const items = hold.items as PricedJson[];
    const fresh = await priceSelection(items.map((item) => ({ serviceId: item.serviceId, optionId: item.optionId })));
    const quote = fresh.quote;
    if (stripe) {
      if (!body.paymentIntentId) throw new HttpError(400, "Card payment is required for the deposit.");
      const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId);
      if (intent.status !== "succeeded") throw new HttpError(400, "The deposit has not been paid.");
      if (intent.amount !== quote.depositCents) throw new HttpError(400, "The deposit amount does not match.");
      if (intent.metadata.holdId !== hold.id) throw new HttpError(400, "This payment does not match the hold.");
    } else if (!(devPayments && body.devPayment)) {
      throw new HttpError(400, "Card payments are not configured.");
    }

    const phone = normalizePhone(body.phone);
    const session = await viewer(req);
    const customer = session?.customer
      ? await prisma.customer.update({
          where: { id: session.customer.id },
          data: { firstName: body.firstName, lastName: body.lastName, email: body.email, phone },
        })
      : await prisma.customer.upsert({
          where: { phone },
          update: { firstName: body.firstName, lastName: body.lastName, email: body.email },
          create: { phone, firstName: body.firstName, lastName: body.lastName, email: body.email },
        });

    const start = DateTime.fromJSDate(hold.startAt, { zone: ZONE });
    await assertSlotOpen(start, quote.durationMinutes, hold.id);
    const end = start.plus({ minutes: quote.durationMinutes });

    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.hold.findUnique({ where: { id: hold.id } });
      if (!current || current.released || current.expiresAt < new Date()) {
        throw new HttpError(410, "This hold has expired.");
      }
      const clash = await tx.booking.findFirst({
        where: { status: "confirmed", startAt: { lt: end.toJSDate() }, endAt: { gt: start.toJSDate() } },
      });
      if (clash) throw new HttpError(409, "That time was just taken. Choose another opening.");
      const created = await tx.booking.create({
        data: {
          token: randomToken(),
          customerId: customer.id,
          holdId: hold.id,
          startAt: start.toJSDate(),
          endAt: end.toJSDate(),
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2 || null,
          city: body.city,
          state: body.state,
          zip: body.zip,
          note: body.note || null,
          subtotalCents: quote.subtotalCents,
          taxCents: quote.taxCents,
          totalCents: quote.totalCents,
          depositCents: quote.depositCents,
          balanceCents: quote.balanceCents,
          priceOnRequest: quote.priceOnRequest,
          stripePaymentIntentId: body.paymentIntentId || null,
          devPayment: !stripe,
          cardSaved: Boolean(body.saveCard),
          policyAccepted: true,
          status: "confirmed",
          items: {
            create: fresh.items.map((item) => ({
              serviceId: item.serviceId,
              serviceName: item.serviceName,
              optionId: item.optionId,
              optionName: item.optionName,
              priceCents: item.priceCents,
              durationMinutes: item.durationMinutes,
              isAddon: item.isAddon,
              requiresDropoff: item.requiresDropoff,
              priceOnRequest: item.priceOnRequest,
              depositCents: item.depositCents,
            })),
          },
        },
        include: { items: true, customer: true },
      });
      await tx.hold.update({ where: { id: hold.id }, data: { released: true } });
      return created;
    }, { isolationLevel: "Serializable" });

    res.status(201).json(presentBooking(booking));
  }),
);

app.get(
  "/bookings/token/:token",
  asyncRoute(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { token: String(req.params.token) },
      include: { items: true, customer: true },
    });
    if (!booking) throw new HttpError(404, "Appointment not found.");
    res.json(presentBooking(booking));
  }),
);

app.post(
  "/auth/code",
  asyncRoute(async (req, res) => {
    const body = z.object({ phone: z.string().min(8).max(20) }).parse(req.body);
    const phone = normalizePhone(body.phone);
    const recent = await prisma.smsCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < 30_000) {
      throw new HttpError(429, "Wait 30 seconds before requesting another code.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.smsCode.create({
      data: {
        phone,
        codeHash: sha256(code),
        expiresAt: DateTime.now().plus({ minutes: 10 }).toJSDate(),
      },
    });
    const sent = await sendSms(phone, `Your brissiecardetailing sign-in code is ${code}`);
    res.json({ ok: true, phone, devCode: sent ? undefined : code });
  }),
);

app.post(
  "/auth/verify",
  asyncRoute(async (req, res) => {
    const body = z.object({ phone: z.string(), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const phone = normalizePhone(body.phone);
    const record = await prisma.smsCode.findFirst({
      where: { phone, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.attempts >= 5) throw new HttpError(400, "That code is expired. Request a new one.");
    if (!safeEqual(record.codeHash, sha256(body.code))) {
      await prisma.smsCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new HttpError(400, "That code does not match.");
    }
    await prisma.smsCode.deleteMany({ where: { phone } });
    const customer = await prisma.customer.upsert({ where: { phone }, update: {}, create: { phone } });
    const token = await createSession("customer", customer.id);
    res.setHeader("Set-Cookie", cookieHeader(token));
    res.json({ id: customer.id, phone: customer.phone, firstName: customer.firstName, lastName: customer.lastName });
  }),
);

app.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearCookieHeader());
  res.json({ ok: true });
});

app.get(
  "/auth/me",
  asyncRoute(async (req, res) => {
    const session = await viewer(req);
    if (!session?.customer) {
      res.json({ customer: null });
      return;
    }
    const customer = session.customer;
    res.json({
      customer: {
        id: customer.id,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      },
    });
  }),
);

app.get(
  "/account/bookings",
  asyncRoute(async (req, res) => {
    const session = await viewer(req);
    if (!session?.customer) throw new HttpError(401, "Sign in to see your appointments.");
    const bookings = await prisma.booking.findMany({
      where: { customerId: session.customer.id, status: "confirmed", startAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
      include: { items: true, customer: true },
      orderBy: { startAt: "asc" },
    });
    res.json(bookings.map(presentBooking));
  }),
);

app.post(
  "/admin/login",
  asyncRoute(async (req, res) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!admin || !(await checkPassword(body.password, admin.passwordHash))) {
      throw new HttpError(401, "Those admin details do not match.");
    }
    const token = await createSession("admin", admin.id);
    res.setHeader("Set-Cookie", cookieHeader(token));
    res.json({ email: admin.email });
  }),
);

app.post("/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearCookieHeader());
  res.json({ ok: true });
});

app.get(
  "/admin/me",
  asyncRoute(async (req, res) => {
    const session = await viewer(req);
    res.json({ admin: session?.admin ? { email: session.admin.email } : null });
  }),
);

app.get(
  "/admin/overview",
  asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const [services, hours, blocked, bookings] = await Promise.all([
      prisma.service.findMany({ include: { options: { orderBy: { sortOrder: "asc" } }, category: true }, orderBy: { sortOrder: "asc" } }),
      prisma.weeklyHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
      prisma.blockedDate.findMany({ orderBy: { date: "asc" } }),
      prisma.booking.findMany({ include: { items: true, customer: true }, orderBy: { startAt: "desc" }, take: 50 }),
    ]);
    res.json({
      services: services.map((service) => ({ ...publicService(service), categoryName: service.category.name })),
      hours,
      blocked,
      bookings: bookings.map(presentBooking),
    });
  }),
);

app.put(
  "/admin/services/:id",
  asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const body = z
      .object({
        summary: z.string().min(1),
        depositCents: z.number().int().min(0).max(500000),
        isAddon: z.boolean(),
        requiresDropoff: z.boolean(),
        options: z.array(
          z.object({
            id: z.string(),
            name: z.string().min(1),
            priceCents: z.number().int().min(0),
            durationMinutes: z.number().int().min(15).max(24 * 60),
            priceOnRequest: z.boolean(),
          }),
        ),
      })
      .parse(req.body);
    await prisma.service.update({
      where: { id: String(req.params.id) },
      data: {
        summary: body.summary,
        depositCents: body.depositCents,
        isAddon: body.isAddon,
        requiresDropoff: body.requiresDropoff,
      },
    });
    for (const option of body.options) {
      await prisma.serviceOption.update({
        where: { id: option.id },
        data: {
          name: option.name,
          priceCents: option.priceOnRequest ? 0 : option.priceCents,
          durationMinutes: option.durationMinutes,
          priceOnRequest: option.priceOnRequest,
        },
      });
    }
    res.json({ ok: true });
  }),
);

app.put(
  "/admin/hours",
  asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const body = z
      .object({
        hours: z.array(
          z.object({
            dayOfWeek: z.number().int().min(0).max(6),
            openMin: z.number().int().min(0).max(1440),
            closeMin: z.number().int().min(0).max(1440),
            closed: z.boolean(),
          }),
        ),
      })
      .parse(req.body);
    for (const hour of body.hours) {
      if (!hour.closed && hour.closeMin <= hour.openMin) throw new HttpError(400, "Closing time must be after opening time.");
      await prisma.weeklyHour.upsert({
        where: { dayOfWeek: hour.dayOfWeek },
        update: hour,
        create: hour,
      });
    }
    res.json({ ok: true });
  }),
);

app.post(
  "/admin/blocked",
  asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(160).optional() }).parse(req.body);
    const row = await prisma.blockedDate.upsert({
      where: { date: body.date },
      update: { reason: body.reason || null },
      create: { date: body.date, reason: body.reason || null },
    });
    res.status(201).json(row);
  }),
);

app.delete(
  "/admin/blocked/:date",
  asyncRoute(async (req, res) => {
    await requireAdmin(req);
    await prisma.blockedDate.delete({ where: { date: String(req.params.date) } }).catch(() => {
      throw new HttpError(404, "That date is not blocked.");
    });
    res.json({ ok: true });
  }),
);

app.post(
  "/text-us",
  asyncRoute(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().min(8).max(20),
        message: z.string().trim().min(2).max(1000),
      })
      .parse(req.body);
    const from = normalizePhone(body.phone);
    const business = await prisma.business.findUnique({ where: { id: "main" } });
    const shop = business?.phoneTel || from;
    await sendSms(
      shop,
      `New website text from ${body.name} (${from}): ${body.message}`,
    );
    res.json({ ok: true });
  }),
);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    const field = String(error.issues[0]?.path?.[0] || "");
    const messages: Record<string, string> = {
      firstName: "Enter your first name.",
      lastName: "Enter your last name.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number.",
      addressLine1: "Enter a street address.",
      city: "Enter a city.",
      state: "Choose a state.",
      zip: "Enter a valid postcode.",
      policyAccepted: "Please agree to the cancellation policy to continue.",
    };
    res.status(400).json({ error: messages[field] || "Check the form and try again." });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("could not serialize") || message.includes("write conflict")) {
    res.status(409).json({ error: "That time was just taken. Choose another opening." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Try again." });
});

type QuoteJson = {
  depositCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  balanceCents: number | null;
  durationMinutes: number;
  priceOnRequest: boolean;
};

type PricedJson = {
  serviceId: string;
  optionId: string;
  serviceName: string;
  optionName: string;
  priceCents: number;
  durationMinutes: number;
  isAddon: boolean;
  requiresDropoff: boolean;
  priceOnRequest: boolean;
  depositCents: number;
};

function presentHold(hold: { id: string; startAt: Date; endAt: Date; expiresAt: Date; items: unknown; quote: unknown }) {
  const start = DateTime.fromJSDate(hold.startAt, { zone: ZONE });
  const end = DateTime.fromJSDate(hold.endAt, { zone: ZONE });
  return {
    id: hold.id,
    date: start.toISODate(),
    time: start.toFormat("HH:mm"),
    endTime: end.toFormat("HH:mm"),
    label: `${start.toFormat("cccc, LLL d")} · ${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")} PT`,
    expiresAt: hold.expiresAt.toISOString(),
    items: hold.items,
    quote: hold.quote,
  };
}

function presentBooking(booking: {
  id: string;
  token: string;
  startAt: Date;
  endAt: Date;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  note: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number | null;
  priceOnRequest: boolean;
  devPayment: boolean;
  cardSaved: boolean;
  status: string;
  items: {
    serviceName: string;
    optionName: string;
    priceCents: number;
    requiresDropoff: boolean;
    priceOnRequest: boolean;
    isAddon: boolean;
  }[];
  customer: { firstName: string | null; lastName: string | null; email: string | null; phone: string };
}) {
  const start = DateTime.fromJSDate(booking.startAt, { zone: ZONE });
  const end = DateTime.fromJSDate(booking.endAt, { zone: ZONE });
  return {
    id: booking.id,
    token: booking.token,
    status: booking.status,
    label: `${start.toFormat("cccc, LLL d")} · ${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")} PT`,
    date: start.toISODate(),
    address: [booking.addressLine1, booking.addressLine2, `${booking.city}, ${booking.state} ${booking.zip}`]
      .filter(Boolean)
      .join(", "),
    note: booking.note,
    subtotalCents: booking.subtotalCents,
    taxCents: booking.taxCents,
    totalCents: booking.totalCents,
    depositCents: booking.depositCents,
    balanceCents: booking.balanceCents,
    priceOnRequest: booking.priceOnRequest,
    devPayment: booking.devPayment,
    cardSaved: booking.cardSaved,
    items: booking.items,
    customer: booking.customer,
  };
}

async function liveHold(id: string) {
  await releaseExpiredHolds();
  const hold = await prisma.hold.findUnique({ where: { id } });
  if (!hold || hold.released || hold.expiresAt < new Date()) throw new HttpError(410, "This hold has expired. Choose the time again.");
  return hold;
}

function normalizePhone(input: string) {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") || digits.length > 10) {
    if (digits.startsWith("610") && digits.length === 12) digits = `61${digits.slice(3)}`;
    if (digits.startsWith("440") && digits.length >= 12) digits = `44${digits.slice(3)}`;
    if (digits.startsWith("640") && digits.length >= 11) digits = `64${digits.slice(3)}`;
    if (digits.length < 8 || digits.length > 15) throw new HttpError(400, "Enter a valid mobile number.");
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new HttpError(400, "Enter a valid mobile number.");
}

async function sendSms(phone: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`SMS to ${phone}: ${body}`);
    return false;
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const payload = new URLSearchParams({ To: phone, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });
  if (!response.ok) throw new HttpError(502, "The sign-in text could not be sent.");
  return true;
}

async function ensureAdmin() {
  const email = "admin@brissiecardetailing.local";
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return;
  await prisma.adminUser.create({
    data: { email, passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || "silvas-admin") },
  });
}

const port = Number(process.env.PORT || 4000);
ensureAdmin()
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
