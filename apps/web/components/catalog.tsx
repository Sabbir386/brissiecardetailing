"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CookieFooter, MobileDock, SummaryCard } from "./shell";
import { useCart } from "@/lib/cart";
import type { Category } from "@/lib/types";

export function Catalog({ categories, added }: { categories: Category[]; added?: string }) {
  const cart = useCart();
  const [active, setActive] = useState(categories[0]?.slug || "");
  const lockUntil = useRef(0);

  function markActive(slug: string) {
    setActive(slug);
    lockUntil.current = Date.now() + 1200;
  }

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const fromHash = categories.some((category) => category.slug === hash) ? hash : "";
    const fromAdded = added
      ? categories.find((category) => category.services.some((service) => service.slug === added))?.slug
      : "";
    const start = fromAdded || fromHash;
    if (start) markActive(start);
  }, [added, categories]);

  useEffect(() => {
    function syncTab() {
      if (Date.now() < lockUntil.current) return;
      const tabs = document.querySelector(".tabs");
      const offset = (tabs instanceof HTMLElement ? tabs.getBoundingClientRect().bottom : 140) + 48;
      let current = categories[0]?.slug || "";
      for (const category of categories) {
        const node = document.getElementById(category.slug);
        if (!node) continue;
        if (node.getBoundingClientRect().top <= offset) current = category.slug;
      }
      setActive(current);
    }
    syncTab();
    window.addEventListener("scroll", syncTab, { passive: true });
    return () => window.removeEventListener("scroll", syncTab);
  }, [categories]);

  useEffect(() => {
    document.querySelector<HTMLElement>(".tabs .active")?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [active]);

  useEffect(() => {
    if (added) {
      document.getElementById(`service-${added}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [added]);

  function showCategory(slug: string) {
    markActive(slug);
    window.history.replaceState(null, "", `#${slug}`);
    const section = document.getElementById(slug);
    if (!section) return;
    const tabs = document.querySelector(".tabs");
    const offset = (tabs instanceof HTMLElement ? tabs.getBoundingClientRect().bottom : 148) + 10;
    const top = section.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  const inCart = new Set(cart.items.map((item) => item.slug));

  return (
    <div className="page">
      <div className="layout">
        <main id="main">
          {cart.items.length ? <h1 className="catalog-title">Add more to your appointment?</h1> : null}
          <nav className="tabs" aria-label="Service categories">
            {categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                className={active === category.slug ? "active" : undefined}
                aria-current={active === category.slug ? "true" : undefined}
                onClick={() => showCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </nav>
          {categories.map((category) => (
            <section className="category" id={category.slug} key={category.id}>
              <h2>{category.name}</h2>
              {category.services.map((service) => {
                const selected = inCart.has(service.slug) || added === service.slug;
                return (
                  <Link
                    className={selected ? "service-row added" : "service-row"}
                    href={`/services/${service.slug}`}
                    key={service.id}
                    id={`service-${service.slug}`}
                  >
                    <div>
                      <h3>{service.name}</h3>
                      <p className="clamp">{service.summary}</p>
                      <p className="meta">{service.priceLine}</p>
                      {selected ? <AddedMark fresh={added === service.slug} /> : null}
                    </div>
                    <Photo src={service.photo} alt={service.name} />
                  </Link>
                );
              })}
            </section>
          ))}
          <CookieFooter />
        </main>
        <SummaryCard />
      </div>
      <MobileDock />
    </div>
  );
}

export function Photo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="thumb">
      {failed ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="eager" decoding="async" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function AddedMark({ fresh }: { fresh?: boolean }) {
  return (
    <span className={`added-pill${fresh ? " fresh" : ""}`}>
      <svg className="added-check" viewBox="0 0 20 20" aria-hidden="true">
        <circle className="added-ring" cx="10" cy="10" r="8.2" />
        <path className="added-tick" d="M6 10.2l2.6 2.6 5.4-5.6" />
      </svg>
      Added
    </span>
  );
}
