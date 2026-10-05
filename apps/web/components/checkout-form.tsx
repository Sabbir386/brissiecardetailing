"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientSend } from "@/lib/api";
import { CookieFooter } from "@/components/shell";
import { countries, states, vehicleLabel } from "@/lib/format";
import type { Booking, Business, Hold } from "@/lib/types";

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

  useEffect(() => {
    clientSend<Hold>(`/holds/${holdId}`)
      .then(setHold)
      .catch((reason: Error) => setError(reason.message));
    clientSend<{ customer: { firstName: string | null; phone: string } | null }>("/auth/me")
      .then((data) => setSignedName(data.customer ? data.customer.firstName || data.customer.phone : null))
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hold || expired) return;
    if (!policy) {
      setError("Please agree to the cancellation policy to continue.");
      return;
    }
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) || "").trim();
    try {
      let paymentIntentId: string | undefined;
      let devPayment = false;
      if (stripeKey) {
        paymentIntentId = await payWithStripe(hold.id, saveCard, stripeKey);
      } else {
        if (!validCard(card)) {
          throw new Error("Enter a card number, expiry, and CVV to continue.");
        }
        devPayment = true;
      }
      const booking = await clientSend<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          holdId: hold.id,
          firstName: field("firstName"),
          lastName: field("lastName"),
          email: field("email"),
          phone: fullPhone(country.dial, field("phone")),
          addressLine1: field("addressLine1"),
          addressLine2: field("addressLine2"),
          city: field("city"),
          state: field("state"),
          zip: field("zip"),
          note: field("note"),
          policyAccepted: true,
          saveCard,
          paymentIntentId,
          devPayment,
        }),
      });
      localStorage.removeItem("brissie-cart");
      router.push(`/confirmation?token=${booking.token}`);
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
        <form id="checkout-form" className="co-form" onSubmit={submit}>
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

            <div className="co-phone">
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
              <input name="phone" required inputMode="tel" placeholder="Phone number" autoComplete="tel-national" />
            </div>
            <p className="co-legal">
              By providing your phone number, you acknowledge you will receive occasional informational messages, including automated messages, on your mobile device from this merchant. Text STOP to opt out at any time, and text HELP to get HELP. Message and data rates may apply.
            </p>

            <div className="co-row2">
              <input name="firstName" required placeholder="First name" autoComplete="given-name" />
              <input name="lastName" required placeholder="Last name" autoComplete="family-name" />
            </div>
            <input name="email" type="email" required placeholder="Email" autoComplete="email" />
          </section>

          <section className="co-block">
            <h2>Card on file</h2>
            <p className="co-copy">
              A card on file is required to book. Purchase will never be made without your approval. Protected and encrypted.
            </p>
            <div className="co-cardbox">
              <CardIcon />
              <input
                value={card.number}
                onChange={(event) => setCard({ ...card, number: formatCard(event.target.value) })}
                placeholder="Card number"
                inputMode="numeric"
                autoComplete="cc-number"
                required={!stripeKey}
                aria-label="Card number"
              />
              <input
                className="co-card-exp"
                value={card.exp}
                onChange={(event) => setCard({ ...card, exp: formatExp(event.target.value) })}
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                required={!stripeKey}
                aria-label="Expiry"
              />
              <input
                className="co-card-cvc"
                value={card.cvc}
                onChange={(event) => setCard({ ...card, cvc: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="CVV"
                inputMode="numeric"
                autoComplete="cc-csc"
                required={!stripeKey}
                aria-label="CVV"
              />
            </div>
            <label className="co-check">
              <input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} />
              <span>I authorise {business.name} to save this card on file for future purchases.</span>
              <i title="The remaining balance is only charged with your approval after the job.">i</i>
            </label>
          </section>

          <section className="co-block">
            <h2>Pay a deposit</h2>
            <div className="co-pay on">
              <strong>
                <CardIcon />
                Credit or debit card
              </strong>
              <p>We’ll use the card on file above.</p>
            </div>
            <div className="co-pay muted" aria-disabled="true">
              <strong>
                <GPayIcon />
                Google Pay
              </strong>
            </div>
            <div className="co-pay muted">
              <strong>
                <GiftIcon />
                Gift card
              </strong>
            </div>
          </section>

          <section className="co-block">
            <h2>Where will this appointment take place?</h2>
            <p className="co-copy">Enter an address, and we’ll come to you.</p>
            <input name="addressLine1" required placeholder="Street Address" autoComplete="address-line1" />
            <input name="addressLine2" placeholder="Apt./Suite" autoComplete="address-line2" />
            <input name="city" required placeholder="City" autoComplete="address-level2" />
            <div className="co-row2">
              <label className="co-select">
                <select name="state" defaultValue="QLD" required aria-label="State">
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <input name="zip" required minLength={3} maxLength={12} placeholder="Postcode" autoComplete="postal-code" />
            </div>
          </section>

          <section className="co-block note-block">
            <div className="co-head-row">
              <h2>Appointment note</h2>
              <button className="co-signin" type="button" onClick={() => setNoteOpen((value) => !value)}>
                {noteOpen ? "Remove" : "Add"}
              </button>
            </div>
            {noteOpen ? <textarea name="note" rows={4} placeholder="Add a note for this appointment" /> : <input type="hidden" name="note" value="" />}
          </section>

          <section className="co-block last">
            <h2>Cancellation policy</h2>
            <p className="co-copy">
              Refunds are subject to the policies of {business.name}. {hold ? cancelWindow(hold.date, business.name) : null}{" "}
              <button className="co-policy-link" type="button" onClick={() => setPolicyOpen(true)}>
                See full policy
              </button>
            </p>
            <label className="co-check">
              <input type="checkbox" checked={policy} onChange={(event) => setPolicy(event.target.checked)} required />
              <span>I have read and agreed to the cancellation policy of {business.name}.</span>
            </label>
          </section>

          {error ? <p className="error">{error}</p> : null}
          <p className="co-fine">
            By clicking on ‘Book Appointment’, you will be charged the deposit amount noted above, and an account can be created for you with this booking. You can opt out later using your mobile number at any time.
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
        <b className="summary-chevron" aria-hidden="true">
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
