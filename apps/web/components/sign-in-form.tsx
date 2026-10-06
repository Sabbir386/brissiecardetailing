"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clientSend } from "@/lib/api";
import { countries } from "@/lib/format";
import { BrandLogo } from "@/components/logo";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";
  const [countryName, setCountryName] = useState("Australia");
  const dial = countries.find((country) => country.name === countryName)?.dial || "+61";
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
    <div className="center-card">
      <BrandLogo href={null} size={88} stacked />
      <h1>Sign in to brissiecardetailing</h1>
      <p className="note">New customers can book without signing in. Use your mobile number here to see appointments you’ve already booked.</p>
      <form onSubmit={sent ? verify : requestCode}>
        <div className="row-2">
          <label className="field">
            Country
            <select value={countryName} onChange={(event) => setCountryName(event.target.value)}>
              {countries.map((country) => (
                <option key={country.name} value={country.name}>
                  {country.name} {country.dial}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Mobile number
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="tel" />
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
  );
}
