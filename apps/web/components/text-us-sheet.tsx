"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/logo";
import { clientSend } from "@/lib/api";
import { countries } from "@/lib/format";
import type { Business } from "@/lib/types";

export function TextUsSheet({
  business,
  open,
  onClose,
}: {
  business: Business;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [countryName, setCountryName] = useState("Australia");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const country = countries.find((item) => item.name === countryName) ?? countries[0];
  const ready = name.trim().length > 1 && phone.replace(/\D/g, "").length >= 6 && message.trim().length > 1;

  function close() {
    setSent(false);
    setError("");
    setBusy(false);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setError("");
    setBusy(true);
    try {
      await clientSend("/text-us", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: `${country.dial}${phone.replace(/\D/g, "")}`,
          message: message.trim(),
        }),
      });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The text could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sheet" role="dialog" aria-modal="true" aria-label="Text us">
      <button className="text-sheet-dim" aria-label="Close" onClick={close} />
      <form className="text-sheet-card" onSubmit={submit}>
        <button type="button" className="text-sheet-close" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>
        <div className="text-sheet-hero">
          <div className="text-avatar">
            <BrandLogo href={null} size={78} withName={false} name={business.name} />
          </div>
          <h2>{business.name}</h2>
          <p>We’ll respond as soon as we can</p>
        </div>
        {sent ? (
          <div className="text-sheet-done">
            <strong>Message sent</strong>
            <p>
              We’ll text you back at {country.dial} {phone}.
            </p>
            <button type="button" className="btn" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="text-fields">
              <label className="text-field">
                <span className="sr-only">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  name="name"
                  autoComplete="name"
                  required
                />
              </label>
              <div className="text-field text-phone">
                <label className="text-country">
                  <span className="sr-only">Country</span>
                  <select value={countryName} onChange={(event) => setCountryName(event.target.value)}>
                    {countries.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.code} {item.name}
                      </option>
                    ))}
                  </select>
                  <strong aria-hidden="true">{country.code}</strong>
                  <ChevronIcon />
                </label>
                <label className="text-phone-input">
                  <span className="sr-only">Phone number</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone number"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                </label>
              </div>
              <label className="text-field">
                <span className="sr-only">Message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Message"
                  rows={5}
                  required
                />
              </label>
            </div>
            {error ? <p className="error">{error}</p> : null}
            <p className="text-legal">
              By entering your phone number and clicking Send text, you agree to receive text messages from brissiecardetailing.
              Reply STOP to opt out, HELP for help. Message and data rates may apply. You certify that you are at least 18 years of
              age. Booking is not required to send a message.
            </p>
            <div className="text-sheet-foot">
              <button className="btn" type="submit" disabled={!ready || busy}>
                {busy ? "Sending…" : "Send text"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
      <path d="M1.5 1.75L6 6.25l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
