"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientSend } from "@/lib/api";
import { CookieFooter } from "@/components/shell";
import { countries, formatPhoneDisplay, states, vehicleLabel } from "@/lib/format";
import type { Booking, Business, Hold } from "@/lib/types";

type PayMethod = "card" | "gpay" | "gift";
type FieldErrors = Partial<Record<"phone" | "firstName" | "lastName" | "email" | "card" | "address" | "city" | "state" | "zip" | "policy" | "gift", string>>;

export function CheckoutForm({ holdId, business }: { holdId: string; business: Business }) {
  const router = useRouter();
  const [hold, setHold] = useState<Hold | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [countryName, setCountryName] = useState("Australia");
  const country = countries.find((item) => item.name === countryName) || countries[0];
  const [saveCard, setSaveCard] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [signedName, setSignedName] = useState<string | null>(null);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [gift, setGift] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [fields, setFields] = useState({
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    note: "",
  });

  useEffect(() => {
    clientSend<Hold>(`/holds/${holdId}`)
      .then(setHold)
      .catch((reason: Error) => setError(reason.message));
    clientSend<{ customer: { firstName: string | null; phone: string } | null }>("/auth/me")
      .then((data) =>
        setSignedName(data.customer ? data.customer.firstName || formatPhoneDisplay(data.customer.phone) : null),
      )
      .catch(() => setSignedName(null));
  }, [holdId]);

  useEffect(() => {
    if (!hold) return;
    const tick = () => setLeft(Math.max(0, new Date(hold.expiresAt).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hold]);

  const holdMinutes = Math.max(1, Math.ceil(left / 60000));
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const expired = hold ? left === 0 : false;
  const canBook = Boolean(hold && !expired && !busy);

  function setField<K extends keyof typeof fields>(name: K, value: (typeof fields)[K]) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current, [name]: undefined };
      if (name === "addressLine1") next.address = undefined;
      return next;
    });
  }

  function validate() {
    const next: FieldErrors = {};
    if (!fields.phone.trim()) next.phone = "Phone is required";
    if (!fields.firstName.trim()) next.firstName = "First name is required";
    if (!fields.lastName.trim()) next.lastName = "Last name is required";
    if (!fields.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = "Please enter a valid email";
    if (!stripeKey && !validCard(card)) next.card = "Saving a card on file is required to book.";
    if (payMethod === "gift" && !gift.trim()) next.gift = "Please enter a gift card";
    if (!fields.addressLine1.trim() || fields.addressLine1.trim().length < 3) next.address = "Please enter a valid street address";
    if (!fields.city.trim()) next.city = "Please enter a valid city";
    if (!fields.state.trim()) next.state = "Please choose a state";
    if (!fields.zip.trim() || fields.zip.trim().length < 3) next.zip = "Please enter a valid postcode";
    if (!policy) next.policy = "Please agree to the cancellation policy";
    return next;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hold || expired) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const first = document.querySelector(".co-invalid, .co-field-error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      let paymentIntentId: string | undefined;
      let devPayment = false;
      if (stripeKey) {
        paymentIntentId = await payWithStripe(hold.id, saveCard, stripeKey);
      } else {
        devPayment = true;
      }
      const booking = await clientSend<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          holdId: hold.id,
          firstName: fields.firstName.trim(),
          lastName: fields.lastName.trim(),
          email: fields.email.trim(),
          phone: fullPhone(country.dial, fields.phone),
          addressLine1: fields.addressLine1.trim(),
          addressLine2: fields.addressLine2.trim(),
          city: fields.city.trim(),
          state: fields.state,
          zip: fields.zip.trim(),
          note: fields.note.trim(),
          policyAccepted: true,
          saveCard,
          paymentIntentId,
          devPayment,
        }),
      });
      localStorage.removeItem("brissie-cart");
      router.push(`/confirmation?token=${booking.token}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Booking failed.");
      setBusy(false);
    }
  }

  if (!hold && !error) {
    return (
      <div className="page checkout-page">
        <p className="book-loading">Holding your time…</p>
      </div>
    );
  }

  return (
    <div className="page checkout-page">
      <header className="co-hero">
        <h1>Checkout</h1>
        {hold && !expired ? (
          <p>
            Appointment held for {holdMinutes} {holdMinutes === 1 ? "minute" : "minutes"}
          </p>
        ) : null}
        {expired ? (
          <p className="error">
            This hold expired. <Link href="/book">Choose another time.</Link>
          </p>
        ) : null}
      </header>

      <div className="co-layout">
        <form id="checkout-form" className="co-form" onSubmit={submit} noValidate>
          <section className="co-block">
            <div className="co-head-row">
              <h2>Contact info</h2>
              {signedName ? (
                <span className="co-signin">{signedName}</span>
              ) : (
                <Link className="co-signin" href="/sign-in">
                  Sign in
                </Link>
              )}
            </div>

            <div className={`co-phone${errors.phone ? " co-invalid" : ""}`}>
              <label className="co-dial">
                <span>
                  {country.code} {country.dial}
                </span>
                <ChevronDown />
                <select value={countryName} onChange={(event) => setCountryName(event.target.value)} aria-label="Country code">
                  {countries.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.code} {item.dial}
                    </option>
                  ))}
                </select>
              </label>
              <input
                name="phone"
                value={fields.phone}
                onChange={(event) => setField("phone", event.target.value)}
                inputMode="tel"
                placeholder="Phone number"
                autoComplete="tel-national"
              />
            </div>
            {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
            <p className="co-legal">
              By providing your phone number, you acknowledge you will receive occasional informational messages, including automated messages, on your mobile device from this merchant. Text STOP to opt out at any time, and text HELP to get HELP. Message and data rates may apply.
            </p>

            <div className="co-row2">
              <div className="co-wrap">
                <input
                  className={errors.firstName ? "co-invalid" : undefined}
                  name="firstName"
                  value={fields.firstName}
                  onChange={(event) => setField("firstName", event.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                />
                {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
              </div>
              <div className="co-wrap">
                <input
                  className={errors.lastName ? "co-invalid" : undefined}
                  name="lastName"
                  value={fields.lastName}
                  onChange={(event) => setField("lastName", event.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
                {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
              </div>
            </div>
            <div className="co-wrap">
              <input
                className={errors.email ? "co-invalid" : undefined}
                name="email"
                type="email"
                value={fields.email}
                onChange={(event) => setField("email", event.target.value)}
                placeholder="Email"
                autoComplete="email"
              />
              {errors.email ? <FieldError>{errors.email}</FieldError> : null}
            </div>
          </section>

          <section className="co-block">
            <h2>Card on file</h2>
            <p className="co-copy">A card on file is required to book. Purchase will never be made without your approval. Protected and encrypted.</p>
            <div className={`co-cardbox${errors.card ? " co-invalid" : ""}`}>
              <CardIcon />
              <input
                value={card.number}
                onChange={(event) => {
                  setCard({ ...card, number: formatCard(event.target.value) });
                  setErrors((current) => ({ ...current, card: undefined }));
                }}
                placeholder="Card number"
                inputMode="numeric"
                autoComplete="cc-number"
                aria-label="Card number"
              />
              <input
                className="co-card-exp"
                value={card.exp}
                onChange={(event) => {
                  setCard({ ...card, exp: formatExp(event.target.value) });
                  setErrors((current) => ({ ...current, card: undefined }));
                }}
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                aria-label="Expiry"
              />
              <input
                className="co-card-cvc"
                value={card.cvc}
                onChange={(event) => {
                  setCard({ ...card, cvc: event.target.value.replace(/\D/g, "").slice(0, 4) });
                  setErrors((current) => ({ ...current, card: undefined }));
                }}
                placeholder="CVV"
                inputMode="numeric"
                autoComplete="cc-csc"
                aria-label="CVV"
              />
            </div>
            <label className="co-check">
              <input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} />
              <span>I authorise {business.name} to save this card on file for future purchases.</span>
              <i title="The remaining balance is only charged with your approval after the job.">i</i>
            </label>
            {errors.card ? <FieldError>{errors.card}</FieldError> : null}
          </section>

          <section className="co-block">
            <h2>Pay a deposit</h2>
            <div className={`co-pay${payMethod === "card" ? " on" : ""}`}>
              <button type="button" className="co-pay-hit" onClick={() => setPayMethod("card")}>
                <strong>
                  <CardIcon />
                  Credit or debit card
                </strong>
              </button>
              {payMethod === "card" ? <p>We’ll use the card on file above.</p> : null}
            </div>
            <div className={`co-pay${payMethod === "gpay" ? " on" : ""}`}>
              <button type="button" className="co-pay-hit" onClick={() => setPayMethod("gpay")}>
                <strong>
                  <GPayIcon />
                  Google Pay
                </strong>
              </button>
            </div>
            <div className={`co-pay${payMethod === "gift" ? " on" : ""}`}>
              <button type="button" className="co-pay-hit" onClick={() => setPayMethod("gift")}>
                <strong>
                  <GiftIcon />
                  Gift card
                </strong>
              </button>
              {payMethod === "gift" ? (
                <div className="co-gift">
                  <p>To use a gift card online, it must cover the total due today:</p>
                  <label className={`co-gift-field${errors.gift ? " co-invalid" : ""}`}>
                    <GiftIcon />
                    <input
                      value={gift}
                      onChange={(event) => {
                        setGift(event.target.value);
                        setErrors((current) => ({ ...current, gift: undefined }));
                      }}
                      placeholder="Gift card"
                      aria-label="Gift card"
                    />
                  </label>
                  {errors.gift ? <FieldError>{errors.gift}</FieldError> : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="co-block">
            <h2>Where will this appointment take place?</h2>
            <p className="co-copy">Enter an address, and we’ll come to you.</p>
            <div className="co-wrap">
              <input
                className={errors.address ? "co-invalid" : undefined}
                name="addressLine1"
                value={fields.addressLine1}
                onChange={(event) => setField("addressLine1", event.target.value)}
                placeholder="Street Address"
                autoComplete="address-line1"
              />
              {errors.address ? <FieldError>{errors.address}</FieldError> : null}
            </div>
            <input name="addressLine2" value={fields.addressLine2} onChange={(event) => setField("addressLine2", event.target.value)} placeholder="Apt./Suite" autoComplete="address-line2" />
            <div className="co-wrap">
              <input
                className={errors.city ? "co-invalid" : undefined}
                name="city"
                value={fields.city}
                onChange={(event) => setField("city", event.target.value)}
                placeholder="City"
                autoComplete="address-level2"
              />
              {errors.city ? <FieldError>{errors.city}</FieldError> : null}
            </div>
            <div className="co-row2">
              <div className="co-wrap">
                <label className={`co-select${errors.state ? " co-invalid" : ""}`}>
                  <select name="state" value={fields.state} onChange={(event) => setField("state", event.target.value)} aria-label="State">
                    <option value="">State</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
                {errors.state ? <FieldError>{errors.state}</FieldError> : null}
              </div>
              <div className="co-wrap">
                <input
                  className={errors.zip ? "co-invalid" : undefined}
                  name="zip"
                  value={fields.zip}
                  onChange={(event) => setField("zip", event.target.value)}
                  minLength={3}
                  maxLength={12}
                  placeholder="Postcode"
                  autoComplete="postal-code"
                />
                {errors.zip ? <FieldError>{errors.zip}</FieldError> : null}
              </div>
            </div>
          </section>

          <section className="co-block note-block">
            <div className="co-head-row">
              <h2>Appointment note</h2>
              <button className="co-signin" type="button" onClick={() => setNoteOpen((value) => !value)}>
                {noteOpen ? "Remove" : "Add"}
              </button>
            </div>
            {noteOpen ? <textarea name="note" rows={4} value={fields.note} onChange={(event) => setField("note", event.target.value)} placeholder="Add a note for this appointment" /> : <input type="hidden" name="note" value="" />}
          </section>

          <section className="co-block last">
            <h2>Cancellation policy</h2>
            <p className="co-copy">
              This appointment can’t be cancelled or rescheduled after the cancellation window has passed.{" "}
              <button className="co-policy-link" type="button" onClick={() => setPolicyOpen(true)}>
                See full policy
              </button>
            </p>
            <label className="co-check">
              <input
                type="checkbox"
                checked={policy}
                onChange={(event) => {
                  setPolicy(event.target.checked);
                  setErrors((current) => ({ ...current, policy: undefined }));
                }}
              />
              <span>I have read and agreed to the cancellation policy of {business.name}.</span>
            </label>
            {errors.policy ? <FieldError>{errors.policy}</FieldError> : null}
          </section>

          {error ? <p className="error">{error}</p> : null}
          <p className="co-fine">
            By clicking on ‘Book Appointment’, you will be charged the deposit amount noted above, and an account can be created for you with this booking. You can sign back in using your mobile number at any time.
          </p>
        </form>

        <aside className="checkout-summary">
          <h2>Appointment summary</h2>
          {hold ? (
            <HoldSummary hold={hold} open={summaryOpen} onToggle={() => setSummaryOpen((value) => !value)} />
          ) : (
            <p className="co-copy">Loading summary…</p>
          )}
          <button className="co-book" form="checkout-form" type="submit" disabled={!canBook}>
            {busy ? "Booking…" : "Book appointment"}
          </button>
        </aside>
      </div>
      <CookieFooter />

      {policyOpen ? (
        <div className="co-modal" role="dialog" aria-modal="true" aria-labelledby="co-policy-title">
          <button className="co-modal-bg" type="button" aria-label="Close policy" onClick={() => setPolicyOpen(false)} />
          <div className="co-modal-card">
            <h3 id="co-policy-title">Cancellation policy</h3>
            <p>{hold ? cancelWindow(hold.date, business.name) : null}</p>
            <p>{business.cancellationPolicy}</p>
            <button className="co-book" type="button" onClick={() => setPolicyOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <p className="co-field-error">
      <ErrorIcon />
      {children}
    </p>
  );
}

function HoldSummary({ hold, open, onToggle }: { hold: Hold; open: boolean; onToggle: () => void }) {
  const when = useMemo(() => summaryWhen(hold), [hold]);
  return (
    <div className={`co-sum${open ? " open" : ""}`}>
      <button className="co-sum-toggle" type="button" onClick={onToggle} aria-expanded={open}>
        <CalendarIcon />
        <span>
          <strong>{when.day}</strong>
          <em>
            {when.range}
            <br />
            Est. due today: {usd(hold.quote.depositCents)}
          </em>
        </span>
        <b className="co-sum-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </b>
      </button>
      {open ? (
        <div className="co-sum-body">
          {hold.items.map((item) => (
            <div className="co-item" key={item.optionId}>
              {item.photo ? <img src={item.photo} alt="" /> : <span className="co-fallback">{item.serviceName.slice(0, 2)}</span>}
              <div>
                <strong>{item.serviceName}</strong>
                <span>{vehicleLabel(item.optionName)}</span>
              </div>
              <b>{item.priceOnRequest ? "Quoted" : usd(item.priceCents)}</b>
            </div>
          ))}
          <div className="co-totals">
            <div>
              <span>Subtotal</span>
              <span>{hold.quote.priceOnRequest ? "Price varies" : usd(hold.quote.subtotalCents)}</span>
            </div>
            <div>
              <span>Taxes</span>
              <span>{usd(hold.quote.taxCents)}</span>
            </div>
            <div>
              <span>Total</span>
              <span>{hold.quote.priceOnRequest ? "Quoted" : usd(hold.quote.totalCents)}</span>
            </div>
            <div className="due">
              <span>Deposit due today</span>
              <span>{usd(hold.quote.depositCents)}</span>
            </div>
            <div className="later">
              <span>Due at appointment</span>
              <span>{hold.quote.balanceCents === null ? "Quoted after inspection" : usd(hold.quote.balanceCents)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function summaryWhen(hold: Hold) {
  const date = new Date(`${hold.date}T12:00:00`);
  const day = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  return { day, range: `${hold.time} – ${hold.endTime}` };
}

function cancelWindow(iso: string, name: string) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - 1);
  const label = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return `Please get in touch with ${name} to cancel or reschedule before 09:00 on ${label}.`;
}

function usd(cents: number) {
  return `US$${(cents / 100).toFixed(2)}`;
}

function formatCard(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function validCard(card: { number: string; exp: string; cvc: string }) {
  const digits = card.number.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  if (!/^\d{2}\/\d{2}$/.test(card.exp)) return false;
  if (!/^\d{3,4}$/.test(card.cvc)) return false;
  return true;
}

function fullPhone(dial: string, national: string) {
  let digits = national.replace(/\D/g, "");
  const cc = dial.replace(/\D/g, "");
  if (digits.startsWith(cc)) digits = digits.slice(cc.length);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `${dial}${digits}`;
}

async function payWithStripe(holdId: string, saveCard: boolean, publishableKey: string) {
  const intent = await clientSend<{ clientSecret?: string; mode: string }>("/payments/intent", {
    method: "POST",
    body: JSON.stringify({ holdId, saveCard }),
  });
  if (!intent.clientSecret) throw new Error("Payment could not be started.");
  const { loadStripe } = await import("@stripe/stripe-js");
  const stripe = await loadStripe(publishableKey);
  if (!stripe) throw new Error("Stripe failed to load.");
  const result = await stripe.confirmCardPayment(intent.clientSecret);
  if (result.error || !result.paymentIntent) throw new Error(result.error?.message || "The deposit was not paid.");
  return result.paymentIntent.id;
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6.2" fill="#d92d20" />
      <path d="M7 3.6v4.2M7 10.2h.01" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M1 1.2l4 3.6 4-3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="1.5" y="4" width="15" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 7.5h15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="3.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 7h13M6 2.5v2M12 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GPayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M8.6 9.1h4.7c.1-.4.2-.8.2-1.3A4.4 4.4 0 0 0 9 3.4 4.4 4.4 0 0 0 4.6 6l1.8 1.4A2.2 2.2 0 0 1 9 5.6c1 0 1.9.6 2.2 1.5H8.6v2z" fill="#4285F4" />
      <path d="M13.3 7.8H9v2.3h2.5a2.7 2.7 0 0 1-2.5 1.8 2.8 2.8 0 0 1-2.6-1.8L4.6 12A4.6 4.6 0 0 0 9 14.6c2.5 0 4.6-1.8 4.6-4.6 0-.4 0-.8-.1-1.2h-.2z" fill="#34A853" />
      <path d="M6.4 10.1A2.8 2.8 0 0 1 6.3 9c0-.4.1-.8.2-1.1L4.6 6.5A4.5 4.5 0 0 0 4.4 9c0 .8.2 1.6.5 2.3l1.5-1.2z" fill="#FBBC05" />
      <path d="M9 5.6c.7 0 1.3.2 1.8.7l1.4-1.4A4.4 4.4 0 0 0 9 3.4c-1.7 0-3.2.9-4.1 2.2L6.6 7A2.2 2.2 0 0 1 9 5.6z" fill="#EA4335" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="8" width="13" height="7.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 11h13M9 8v7.5M9 8c0-2 1.4-3.4 3-2.2C13.2 6.6 12 8 12 8M9 8C9 6 7.6 4.6 6 5.8 4.8 6.6 6 8 6 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
