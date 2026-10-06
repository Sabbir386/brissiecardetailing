"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clientSend } from "@/lib/api";
import { countries } from "@/lib/format";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";
  const [countryName, setCountryName] = useState("Australia");
  const country = countries.find((item) => item.name === countryName) || countries[0];
  const dial = country.dial;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [onScreenCode, setOnScreenCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setCopied(false);
    try {
      const result = await clientSend<{ devCode?: string }>("/auth/code", {
        method: "POST",
        body: JSON.stringify({ phone: `${dial}${phone.replace(/\D/g, "")}` }),
      });
      const nextCode = result.devCode || "";
      setSent(true);
      setOnScreenCode(nextCode);
      setCode(nextCode);
      setWait(30);
      const timer = window.setInterval(() => {
        setWait((value) => {
          if (value <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send the code.");
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await clientSend("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ phone: `${dial}${phone.replace(/\D/g, "")}`, code }),
      });
      router.push(next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That code did not work.");
    }
  }

  async function copyCode() {
    if (!onScreenCode) return;
    try {
      await navigator.clipboard.writeText(onScreenCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page signin-page">
      <div className="center-card">
        <h1>Sign in</h1>
        <p className="note">
          Use your mobile number to see appointments you’ve already booked. New customers can book without signing in.
        </p>
        <form onSubmit={sent ? verify : requestCode}>
          <div className="signin-phone">
            <label className="field">
              Country
              <span className="signin-dial">
                <span>
                  {country.code} {country.dial}
                </span>
                <ChevronDown />
                <select value={countryName} onChange={(event) => setCountryName(event.target.value)} aria-label="Country">
                  {countries.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} {item.dial}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="field">
              Mobile number
              <input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="tel" autoComplete="tel" />
            </label>
          </div>
        {onScreenCode ? (
          <div className="signin-otp">
            <p className="signin-otp-kicker">Your sign-in code</p>
            <div className="signin-otp-digits" aria-label={`Sign-in code ${onScreenCode.split("").join(" ")}`}>
              {onScreenCode.split("").map((digit, index) => (
                <span key={`${digit}-${index}`}>{digit}</span>
              ))}
            </div>
            <p className="signin-otp-copy">Enter this code below. It expires in 10 minutes.</p>
            <button className="signin-otp-copy-btn" type="button" onClick={copyCode}>
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
        ) : null}
        {sent ? (
          <label className="field">
            6-digit code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              inputMode="numeric"
              pattern="\d{6}"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          {sent ? "Sign in" : "Request Sign-in Code"}
        </button>
      </form>
      {sent ? (
        <button className="btn secondary" type="button" disabled={wait > 0} onClick={() => requestCode()}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      ) : null}
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
      <path d="M1.5 1.75L6 6.25l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
