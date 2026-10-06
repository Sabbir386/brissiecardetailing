"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CookieFooter, MobileDock, SummaryCard } from "./shell";
import { useCart } from "@/lib/cart";
import { setScrollLocked } from "@/lib/scroll-lock";
import type { Category } from "@/lib/types";

const PINNED_TABS = 2;

function priceMeta(line: string) {
  return line.replace(" · ", " • ");
}

export function Catalog({ categories, added }: { categories: Category[]; added?: string }) {
  const cart = useCart();
  const [active, setActive] = useState(categories[0]?.slug || "");
  const [moreOpen, setMoreOpen] = useState(false);
  const lockUntil = useRef(0);
  const pendingCategory = useRef<string | null>(null);
  const pinned = categories.slice(0, PINNED_TABS);
  const showMore = categories.length > PINNED_TABS;
  const moreActive = showMore && !pinned.some((category) => category.slug === active);

  function markActive(slug: string) {
    setActive(slug);
    lockUntil.current = Date.now() + 1200;
  }

  function scrollToCategory(slug: string) {
    const section = document.getElementById(slug);
    if (!section) return;
    const tabs = document.querySelector(".tabs");
    const offset = (tabs instanceof HTMLElement ? tabs.getBoundingClientRect().bottom : 148) + 10;
    const top = section.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function showCategory(slug: string) {
    markActive(slug);
    window.history.replaceState(null, "", `#${slug}`);
    if (moreOpen) {
      pendingCategory.current = slug;
      setMoreOpen(false);
      return;
    }
    scrollToCategory(slug);
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
    if (window.matchMedia("(max-width: 900px)").matches) return;
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

  useEffect(() => {
    setScrollLocked(moreOpen);
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  useEffect(() => {
    if (moreOpen || !pendingCategory.current) return;
    const slug = pendingCategory.current;
    pendingCategory.current = null;
    scrollToCategory(slug);
  }, [moreOpen]);

  useEffect(() => {
    return () => setScrollLocked(false);
  }, []);

  const inCart = new Set(cart.items.map((item) => item.slug));

  return (
    <div className="page">
      <div className="layout">
        <main id="main">
          {cart.items.length ? <h1 className="catalog-title">Add more to your appointment?</h1> : null}
          <nav className="tabs" aria-label="Service categories">
            {categories.map((category, index) => (
              <button
                key={category.slug}
                type="button"
                className={`${active === category.slug ? "active" : ""}${index >= PINNED_TABS ? " tab-extra" : ""}`.trim()}
                aria-current={active === category.slug ? "true" : undefined}
                onClick={() => showCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
            {showMore ? (
              <button
                type="button"
                className={`tab-more${moreOpen ? " open" : ""}${moreActive ? " active" : ""}`}
                aria-expanded={moreOpen}
                aria-controls="category-more"
                onClick={() => setMoreOpen((open) => !open)}
              >
                More
                <MoreCaret />
              </button>
            ) : null}
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
                      <p className="meta">{priceMeta(service.priceLine)}</p>
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
      {moreOpen ? (
        <>
          <button className="tab-more-overlay" type="button" aria-label="Close categories" onClick={() => setMoreOpen(false)} />
          <div className="tab-more-sheet" id="category-more" role="dialog" aria-modal="true" aria-label="More categories">
            {categories.map((category) => (
              <button key={category.slug} type="button" onClick={() => showCategory(category.slug)}>
                {category.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
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

function MoreCaret() {
  return (
    <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
      <path d="M1 1.5L6 6.5L11 1.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
