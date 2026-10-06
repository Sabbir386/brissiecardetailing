"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { clientSend } from "@/lib/api";
import { durationPhrase, formatPhoneDisplay, money, vehicleLabel } from "@/lib/format";
import { BrandLogo } from "@/components/logo";
import { TextUsSheet } from "@/components/text-us-sheet";
import { setScrollLocked } from "@/lib/scroll-lock";
import type { Business } from "@/lib/types";

type MenuCustomer = { firstName: string | null; lastName: string | null; phone: string };

const adminNav: { tab: string; href: string; label: string; hint: string }[] = [
  { tab: "today", href: "/admin", label: "Today", hint: "Jobs on the book" },
  { tab: "jobs", href: "/admin?tab=jobs", label: "Jobs", hint: "All bookings" },
  { tab: "clients", href: "/admin?tab=clients", label: "Clients", hint: "Customer list" },
  { tab: "inbox", href: "/admin?tab=inbox", label: "Inbox", hint: "Customer texts" },
  { tab: "menu", href: "/admin?tab=menu", label: "Menu", hint: "Services and prices" },
  { tab: "hours", href: "/admin?tab=hours", label: "Hours", hint: "Opening times" },
  { tab: "shop", href: "/admin?tab=shop", label: "Shop", hint: "Business details" },
  { tab: "settings", href: "/admin?tab=settings", label: "Settings", hint: "Email and password" },
];

export function Shell({ business, children }: { business: Business; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const shopDesk = pathname.startsWith("/admin");
  const quiet = pathname === "/book" || pathname === "/checkout";
  const hideTextUs = pathname === "/checkout" || shopDesk;
  const [menu, setMenu] = useState(false);
  const [textUs, setTextUs] = useState(false);
  const [cookies, setCookies] = useState<"unknown" | "accepted" | "rejected">("unknown");
  const [customer, setCustomer] = useState<MenuCustomer | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState("today");

  useEffect(() => {
    const stored = localStorage.getItem("brissie-cookies");
    if (stored === "accepted" || stored === "rejected") setCookies(stored);
    else setCookies("unknown");
    if (shopDesk) {
      setCustomer(null);
      return;
    }
    clientSend<{ customer: MenuCustomer | null }>("/auth/me")
      .then((data) => setCustomer(data.customer))
      .catch(() => setCustomer(null));
  }, [pathname, shopDesk]);

  useEffect(() => {
    if (!shopDesk) {
      setAdminEmail(null);
      return;
    }
    function refreshAdmin() {
      clientSend<{ admin: { email: string } | null }>("/admin/me")
        .then((data) => setAdminEmail(data.admin?.email ?? null))
        .catch(() => setAdminEmail(null));
      setAdminTab(new URLSearchParams(window.location.search).get("tab") || "today");
    }
    refreshAdmin();
    window.addEventListener("brissie-admin", refreshAdmin);
    return () => window.removeEventListener("brissie-admin", refreshAdmin);
  }, [shopDesk, pathname, menu]);

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    setScrollLocked(menu || textUs);
    if (!menu && !textUs) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (textUs) setTextUs(false);
      else setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, textUs]);

  useEffect(() => {
    document.documentElement.classList.toggle("book-mode", quiet);
    document.body.classList.toggle("book-mode", quiet);
    return () => {
      document.documentElement.classList.remove("book-mode");
      document.body.classList.remove("book-mode");
    };
  }, [quiet]);

  useEffect(() => {
    return () => setScrollLocked(false);
  }, []);

  function chooseCookies(value: "accepted" | "rejected") {
    localStorage.setItem("brissie-cookies", value);
    setCookies(value);
  }

  async function signOut() {
    try {
      await clientSend("/auth/logout", { method: "POST" });
    } catch {
      /* still leave the local session */
    }
    setCustomer(null);
    setMenu(false);
    window.location.assign("/");
  }

  async function adminSignOut() {
    try {
      await clientSend("/admin/logout", { method: "POST" });
    } catch {
      /* still leave the local session */
    }
    setAdminEmail(null);
    setMenu(false);
    window.dispatchEvent(new Event("brissie-admin"));
    window.location.assign("/admin");
  }

  function go(href: string) {
    if (href.startsWith("/admin")) {
      setAdminTab(new URL(href, window.location.origin).searchParams.get("tab") || "today");
    }
    router.push(href);
    setMenu(false);
  }

  return (
    <div className={quiet ? "book-mode" : undefined}>
      <a className="skip" href="#main">
        Skip to services
      </a>
      <header className="topbar">
        <BrandLogo name={business.name} />
        <button className="menu-toggle" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(true)}>
          <span />
          <span />
          <span />
        </button>
      </header>
      {children}
      {textUs || hideTextUs ? null : (
        <button className="text-us" type="button" onClick={() => setTextUs(true)}>
          <span className="text-us-icon" aria-hidden="true">
            <ChatBadgeIcon />
          </span>
          <span className="text-us-label">Text us</span>
        </button>
      )}
      {cookies === "unknown" && !quiet && !shopDesk ? (
        <aside className="cookie">
          <strong>Cookie preferences</strong>
          <p className="note">Analytics stay off until you accept. Booking works either way.</p>
          <div className="actions">
            <button className="btn slim" onClick={() => chooseCookies("accepted")}>
              Accept
            </button>
            <button className="btn slim secondary" onClick={() => chooseCookies("rejected")}>
              Reject
            </button>
          </div>
        </aside>
      ) : null}
      {menu ? (
        <>
          <button className="overlay" aria-label="Close menu" onClick={() => setMenu(false)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-head">
              <BrandLogo href="/" name={business.name} size={52} />
              <button className="drawer-close" aria-label="Close" onClick={() => setMenu(false)}>
                <CloseIcon />
              </button>
            </div>
            {shopDesk ? (
              <>
                <div className="drawer-body">
                  {adminEmail
                    ? adminNav.map((item) => (
                        <Link
                          key={item.tab}
                          className={adminTab === item.tab ? "drawer-item compact on" : "drawer-item compact"}
                          href={item.href}
                          aria-current={adminTab === item.tab ? "page" : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            go(item.href);
                          }}
                        >
                          <span className="drawer-copy">
                            <span>{item.label}</span>
                            <strong>{item.hint}</strong>
                          </span>
                        </Link>
                      ))
                    : (
                        <Link
                          className="drawer-item"
                          href="/"
                          onClick={(event) => {
                            event.preventDefault();
                            go("/");
                          }}
                        >
                          <span className="drawer-copy">
                            <span>Website</span>
                            <strong>View the public site</strong>
                          </span>
                        </Link>
                      )}
                </div>
                <div className="drawer-foot">
                  {adminEmail ? (
                    <div className="drawer-account">
                      <div className="drawer-account-row">
                        <span className="drawer-avatar" aria-hidden="true">
                          <UserIcon />
                        </span>
                        <span className="drawer-account-copy">
                          <strong>Website admin</strong>
                          <em>{adminEmail}</em>
                        </span>
                      </div>
                      <Link className="btn secondary" href="/" onClick={() => setMenu(false)}>
                        View website
                      </Link>
                      <button className="drawer-logout" type="button" onClick={adminSignOut}>
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <div className="drawer-account guest">
                      <div className="drawer-account-row">
                        <span className="drawer-avatar" aria-hidden="true">
                          <UserIcon />
                        </span>
                        <span className="drawer-account-copy">
                          <strong>Admin sign in</strong>
                          <em>Use your email and password on this page to manage the website.</em>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="drawer-body">
                  <div className="drawer-item static">
                    <span className="drawer-copy">
                      <span>Location</span>
                      <strong>{business.locationLine}</strong>
                    </span>
                  </div>
                  <a className="drawer-item" href={`tel:${business.phoneTel}`}>
                    <span className="drawer-copy">
                      <span>Phone</span>
                      <strong>{business.phone}</strong>
                    </span>
                    <span className="round-action" aria-hidden="true">
                      <PhoneIcon />
                    </span>
                  </a>
                  <Hours business={business} />
                  <div className="drawer-item static">
                    <span className="drawer-copy">
                      <span>Follow</span>
                    </span>
                    <span className="socials">
                      <a
                        href={business.instagramUrl || "https://www.instagram.com/brissiecardetailing"}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Instagram"
                        className="round-action"
                      >
                        <InstagramIcon />
                      </a>
                      <a
                        href={business.facebookUrl || "https://www.facebook.com/brissiecardetailing"}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Facebook"
                        className="round-action"
                      >
                        <FacebookIcon />
                      </a>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="drawer-item"
                    onClick={() => {
                      setMenu(false);
                      setTextUs(true);
                    }}
                  >
                    <span className="drawer-copy">
                      <span>Text us</span>
                      <strong>We’ll reply as soon as we can</strong>
                    </span>
                    <span className="round-action" aria-hidden="true">
                      <MessageIcon />
                    </span>
                  </button>
                </div>
                <div className="drawer-foot">
                  {customer ? (
                    <div className="drawer-account">
                      <div className="drawer-account-row">
                        <span className="drawer-avatar" aria-hidden="true">
                          <UserIcon />
                        </span>
                        <span className="drawer-account-copy">
                          <strong>{customer.firstName ? `Hi, ${customer.firstName}` : "You're signed in"}</strong>
                          <em>{formatPhoneDisplay(customer.phone)}</em>
                        </span>
                      </div>
                      <Link className="btn" href="/account" onClick={() => setMenu(false)}>
                        Your appointments
                      </Link>
                      <button className="drawer-logout" type="button" onClick={signOut}>
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <div className="drawer-account guest">
                      <div className="drawer-account-row">
                        <span className="drawer-avatar" aria-hidden="true">
                          <UserIcon />
                        </span>
                        <span className="drawer-account-copy">
                          <strong>Welcome</strong>
                          <em>Book without an account, or sign in to see your bookings.</em>
                        </span>
                      </div>
                      <Link className="btn" href="/sign-in" onClick={() => setMenu(false)}>
                        Sign in
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </>
      ) : null}
      <TextUsSheet business={business} open={textUs} onClose={() => setTextUs(false)} />
    </div>
  );
}

function Hours({ business }: { business: Business }) {
  const [open, setOpen] = useState(false);
  const week = mondayFirst(business.hours);
  return (
    <div className={`drawer-item hours${open ? " open" : ""}`}>
      <div className="drawer-copy">
        <span>Hours</span>
        <strong>{business.openUntilLabel}</strong>
        {open ? (
          <>
            <ul className="hours-list">
              {week.map((hour) => (
                <li key={hour.dayOfWeek} className={hourClass(hour)}>
                  <span>{hour.label}</span>
                  <span>{hour.closed ? "Closed" : `${hour.open} – ${hour.close}`}</span>
                </li>
              ))}
            </ul>
            <p className="hours-zone">Times shown in business time zone ({business.hoursZoneLabel || "GMT-7"})</p>
          </>
        ) : null}
      </div>
      <button type="button" className="round-action" aria-expanded={open} aria-label="Show weekly hours" onClick={() => setOpen((value) => !value)}>
        <ChevronIcon open={open} />
      </button>
    </div>
  );
}

function mondayFirst(hours: Business["hours"]) {
  return [...hours].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7));
}

function hourClass(hour: Business["hours"][number]) {
  const classes = [];
  if (hour.today) classes.push("today");
  if (hour.closed) classes.push("closed");
  return classes.join(" ") || undefined;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4.2 2.8h2.1l1 2.6-1.3 1.3a10.5 10.5 0 0 0 5.3 5.3l1.3-1.3 2.6 1v2.1c0 .7-.6 1.3-1.3 1.3C6.8 15.1 2.9 11.2 2.9 6.1c0-.7.6-1.3 1.3-1.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s ease" }}>
      <path d="M3.5 6.2 8 10.4l4.5-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11.2" cy="4.8" r="0.7" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10.6 4.4H9.2c-.5 0-.8.3-.8.8v1.4h2.1l-.3 2H8.4V14H6.2V8.6H4.7v-2h1.5V5.4c0-1.6 1-2.6 2.6-2.6h1.8v1.6Z" fill="currentColor" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="drawer-avatar-user" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.1" r="3.6" fill="currentColor" />
      <path d="M5 19.2c.7-3.6 3.2-5.5 7-5.5s6.3 1.9 7 5.5" fill="currentColor" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 3.5h12v7H6l-3 2.5V3.5z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ChatBadgeIcon() {
  return (
    <svg className="text-us-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M5 5.8h14a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H11.1L7 20.4v-3.1H5A2.2 2.2 0 0 1 2.8 15.1V8A2.2 2.2 0 0 1 5 5.8z"
        fill="currentColor"
      />
      <circle className="text-us-dot" cx="8.2" cy="11.1" r="1.15" fill="#FFE9A8" />
      <circle className="text-us-dot delay" cx="12" cy="11.1" r="1.15" fill="#FFE9A8" />
      <circle className="text-us-dot delay2" cx="15.8" cy="11.1" r="1.15" fill="#FFE9A8" />
    </svg>
  );
}

export function SummaryCard() {
  const cart = useCart();
  return (
    <aside className="summary">
      <h2>Appointment summary</h2>
      <SummaryPanel />
      <NextButton ready={cart.hasMain} />
    </aside>
  );
}

function NextButton({ ready }: { ready: boolean }) {
  return (
    <Link
      className={`btn next-cta${ready ? "" : " disabled"}`}
      href={ready ? "/book" : "#"}
      aria-disabled={!ready}
      onClick={(event) => {
        if (!ready) event.preventDefault();
      }}
    >
      <span>{ready ? "Next" : "Add a main service"}</span>
      {ready ? <NextArrow /> : null}
    </Link>
  );
}

function SummaryPanel() {
  const cart = useCart();
  const [open, setOpen] = useState(true);
  if (!cart.items.length) return <div className="empty">No services added yet</div>;
  const count = cart.items.length;
  const total = cart.quote.priceOnRequest
    ? cart.quote.subtotalCents
      ? `${money(cart.quote.subtotalCents)}+`
      : "Price varies"
    : money(cart.quote.totalCents);
  return (
    <div className={`summary-panel${open ? " open" : ""}`}>
      <button type="button" className="summary-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>
          <strong>{count === 1 ? "1 service" : `${count} services`}</strong>
          <em>
            {total} · {durationPhrase(cart.quote.durationMinutes)}
          </em>
        </span>
        <span className="summary-chevron" aria-hidden="true">
          <ChevronUp />
        </span>
      </button>
      {open ? <SummaryBody /> : null}
    </div>
  );
}

export function SummaryBody() {
  const cart = useCart();
  return (
    <div className="summary-body">
      <ul className="summary-timeline">
        {cart.items.map((item, index) => (
          <li className="summary-item" key={item.optionId}>
            <span className={`summary-rail${index === cart.items.length - 1 ? " last" : ""}`} aria-hidden="true">
              <i />
            </span>
            <div className="summary-copy">
              <strong>{item.serviceName}</strong>
              <span>{vehicleLabel(item.optionName)}</span>
            </div>
            <b>{item.priceOnRequest ? "Quoted" : item.priceLabel}</b>
            <div className="summary-actions">
              <Link className="summary-icon" href={`/services/${item.slug}`} aria-label={`Edit ${item.serviceName}`}>
                <PencilIcon />
              </Link>
              <button className="summary-icon" type="button" aria-label={`Remove ${item.serviceName}`} onClick={() => cart.remove(item.optionId)}>
                <CloseSmall />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="totals">
        <div>
          <span>Deposit due today</span>
          <span>{money(cart.quote.depositCents)}</span>
        </div>
        <div className="due">
          <span>{cart.quote.priceOnRequest ? "Known services" : "Total"}</span>
          <span>{cart.quote.priceOnRequest ? money(cart.quote.subtotalCents) : money(cart.quote.totalCents)}</span>
        </div>
      </div>
    </div>
  );
}

export function MobileDock({ showNext = true }: { showNext?: boolean }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  if (!cart.items.length) return null;
  const count = cart.items.length;
  const total = cart.quote.priceOnRequest
    ? cart.quote.subtotalCents
      ? `${money(cart.quote.subtotalCents)}+`
      : "Price varies"
    : money(cart.quote.totalCents);
  return (
    <div className={`dock${open ? " open" : ""}${showNext ? "" : " dock-simple"}`}>
      {open ? (
        <div className="dock-sheet">
          <SummaryBody />
        </div>
      ) : null}
      <div className="dock-bar">
        <button type="button" className="dock-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span>
            <strong>{count === 1 ? "1 service" : `${count} services`}</strong>
            <em>
              {total} · {durationPhrase(cart.quote.durationMinutes)}
            </em>
          </span>
          <span className="summary-chevron" aria-hidden="true">
            <ChevronUp />
          </span>
        </button>
        {showNext ? (
          <Link className="btn slim next-cta" href={cart.hasMain ? "/book" : "/"}>
            <span>{cart.hasMain ? "Next" : "Add"}</span>
            {cart.hasMain ? <NextArrow /> : null}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ChevronUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M11.4 2.6l1.9 1.9-8 8H3.4v-1.9l8-8zM10.2 3.8l1.9 1.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function CloseSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NextArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5L12.5 8 8.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CookieFooter() {
  return (
    <p className="footer-note">
      <button
        onClick={() => {
          localStorage.removeItem("brissie-cookies");
          window.location.reload();
        }}
      >
        Cookie Preferences
      </button>
    </p>
  );
}
