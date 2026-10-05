import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  let services: { slug: string }[] = [];
  try {
    const categories = await getCatalog();
    services = categories.flatMap((category) => category.services);
  } catch {
    services = [];
  }
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    ...services.map((service) => ({
      url: `${site}/services/${service.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
