"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Quote } from "./types";

const KEY = "brissie-cart";

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  add: (item: CartItem) => void;
  remove: (optionId: string) => void;
  clear: () => void;
  quote: Quote;
  hasMain: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function roundUp30(minutes: number) {
  return Math.max(30, Math.ceil(minutes / 30) * 30);
}

export function quoteCart(items: CartItem[]): Quote {
  const priceOnRequest = items.some((item) => item.priceOnRequest);
  const subtotalCents = items.reduce((sum, item) => sum + (item.priceOnRequest ? 0 : item.priceCents), 0);
  const depositRaw = items.length ? Math.max(...items.map((item) => item.depositCents)) : 0;
  const depositCents = !items.length ? 0 : priceOnRequest ? depositRaw : Math.min(depositRaw, subtotalCents);
  return {
    subtotalCents,
    taxCents: 0,
    totalCents: subtotalCents,
    depositCents,
    balanceCents: priceOnRequest ? null : subtotalCents - depositCents,
    durationMinutes: roundUp30(items.reduce((sum, item) => sum + item.durationMinutes, 0) || 0),
    priceOnRequest,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setItems(JSON.parse(stored) as CartItem[]);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      ready,
      add: (item) =>
        setItems((current) => {
          const withoutSameService = current.filter((row) => row.serviceId !== item.serviceId);
          return [...withoutSameService, item];
        }),
      remove: (optionId) => setItems((current) => current.filter((row) => row.optionId !== optionId)),
      clear: () => setItems([]),
      quote: quoteCart(items),
      hasMain: items.some((item) => !item.isAddon),
    };
  }, [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Cart is unavailable");
  return value;
}
