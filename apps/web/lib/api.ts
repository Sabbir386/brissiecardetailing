import type { Availability, Booking, Business, Category, Hold, Service } from "./types";

const internal = process.env.API_INTERNAL_URL || "http://localhost:4000";

export async function serverGet<T>(path: string, revalidate = 60): Promise<T> {
  const response = await fetch(
    `${internal}${path}`,
    revalidate === 0 ? { cache: "no-store" } : { next: { revalidate } },
  );
  if (!response.ok) throw new Error(`API ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}

export async function getBusiness(): Promise<Business> {
  try {
    return await serverGet<Business>("/business", 0);
  } catch {
    return {
      name: "brissiecardetailing",
      phone: "(714) 277-7003",
      phoneTel: "+17142777003",
      locationLine: "We'll come to you!",
      timezone: "America/Los_Angeles",
      instagramUrl: "https://www.instagram.com/brissiecardetailing",
      facebookUrl: "https://www.facebook.com/brissiecardetailing",
      cancellationPolicy: "Deposits are non-refundable.",
      openUntilLabel: "Open until 19:00",
      hoursZoneLabel: "GMT-7",
      hours: [],
    };
  }
}

export async function getCatalog() {
  try {
    return await serverGet<Category[]>("/services", 0);
  } catch {
    return [];
  }
}

export async function getService(slug: string) {
  return serverGet<Service>(`/services/${slug}`, 0);
}

export async function clientSend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export type { Availability, Booking, Hold };
