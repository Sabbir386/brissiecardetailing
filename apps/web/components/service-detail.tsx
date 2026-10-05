"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { vehicleLabel } from "@/lib/format";
import type { Service } from "@/lib/types";

export function ServiceDetail({ service }: { service: Service }) {
  const cart = useCart();
  const router = useRouter();
  const inCart = cart.ready ? cart.items.find((item) => item.slug === service.slug) : undefined;
  const [optionId, setOptionId] = useState(service.options[0]?.id ?? "");
  const option = useMemo(
    () => service.options.find((item) => item.id === optionId) ?? service.options[0],
    [optionId, service.options],
  );
  const groups = groupBullets(service.bullets);
  const intro = service.paragraphs.find((paragraph) => !/deposit/i.test(paragraph));
  const notes = service.warnings.slice(0, 2);
  const legal = service.warnings.slice(2);
  const editing = Boolean(inCart);

  useEffect(() => {
    if (inCart) setOptionId(inCart.optionId);
  }, [inCart]);

  function save() {
    if (!option) return;
    cart.add({
      serviceId: service.id,
      slug: service.slug,
      serviceName: service.name,
      optionId: option.id,
      optionName: vehicleLabel(option.name),
      priceCents: option.priceCents,
      durationMinutes: option.durationMinutes,
      isAddon: service.isAddon,
      requiresDropoff: service.requiresDropoff,
      priceOnRequest: option.priceOnRequest,
      depositCents: service.depositCents,
      priceLabel: option.priceLabel,
      photo: service.photo,
    });
    router.push(`/?added=${service.slug}`);
  }

  function remove() {
    if (inCart) cart.remove(inCart.optionId);
    router.push("/");
  }

  return (
    <div className="page">
      <p className="crumbs">
        <Link href="/">All services</Link>
        <span> / {service.name}</span>
      </p>
      <div className="detail">
        <article>
          <h1>{service.name}</h1>
          <p className="meta">{service.priceLine}</p>
          {intro ? <p className="lede">{intro}</p> : null}

          {groups.map((group) => (
            <div key={group.name || "includes"}>
              {group.name ? <p className="includes-head">{group.name}:</p> : null}
              <ul className="includes">
                {group.items.map((item) => {
                  const parts = splitBullet(item);
                  return (
                    <li key={item}>
                      {parts.label ? <strong>{parts.label}</strong> : null}
                      <CheckIcon />
                      {parts.rest ? <span>{parts.rest}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {notes.map((note) => (
            <p className="callout" key={note}>
              <WarnIcon />
              <span>
                <strong>Note:</strong> {note}
              </span>
            </p>
          ))}
          {legal.map((item) => (
            <p className="legal-copy" key={item}>
              {item}
            </p>
          ))}

          <p className="legal-copy">
            {service.depositLabel} deposit is required to secure your appointment.
          </p>
          <p className="legal-copy">
            The rest of payment is required once the job is finished. You agree to this by booking. All deposits are
            non-refundable.
          </p>
          {service.requiresDropoff ? (
            <p className="callout">
              <WarnIcon />
              <span>This service requires vehicle drop-off.</span>
            </p>
          ) : null}
          {service.isAddon ? (
            <p className="callout">
              <WarnIcon />
              <span>This add-on must be booked with a main detail package.</span>
            </p>
          ) : null}

          <h2 className="options-title">Options</h2>
          <div className="option-list">
            {service.options.map((item) => (
              <button
                key={item.id}
                className={`option${item.id === option?.id ? " selected" : ""}`}
                onClick={() => setOptionId(item.id)}
                type="button"
              >
                <span>
                  <strong>{vehicleLabel(item.name)}</strong>
                  <span className="note">
                    {item.priceLabel} · {item.durationLabel}
                  </span>
                </span>
                <span className="radio" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className={`detail-actions${editing ? " split" : ""}`}>
            {editing ? (
              <button className="btn btn-remove" type="button" onClick={remove}>
                <RemoveIcon />
                Remove
              </button>
            ) : null}
            <button className="btn btn-update" type="button" onClick={save} disabled={!option}>
              {editing ? "Update" : "Add"}
            </button>
          </div>
        </article>
        <div className="hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={service.photo} alt={service.name} />
        </div>
      </div>
    </div>
  );
}

function splitBullet(text: string) {
  const index = text.indexOf(":");
  if (index === -1) return { label: "", rest: text };
  return { label: text.slice(0, index).trim(), rest: text.slice(index + 1).trim() };
}

function groupBullets(bullets: Service["bullets"]) {
  const groups: { name: string; items: string[] }[] = [];
  for (const bullet of bullets) {
    const name = bullet.group || "";
    const last = groups[groups.length - 1];
    if (!last || last.name !== name) groups.push({ name, items: [bullet.text] });
    else last.items.push(bullet.text);
  }
  return groups;
}

function CheckIcon() {
  return (
    <svg className="include-check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect width="16" height="16" rx="3" fill="#1f9d55" />
      <path d="M4.2 8.2l2.4 2.4 5.2-5.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 2.2L16.4 15H1.6L9 2.2z" fill="#e6b325" />
      <path d="M9 7v4.2M9 13.2h.01" stroke="#141311" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg className="btn-remove-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 5.2l5.6 5.6M10.8 5.2L5.2 10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
