import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { getCatalog } from "@/lib/api";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Services",
  description: "Standard details, full details, ceramic coatings, and off-road resets. Mobile service, deposit due today.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const params = await searchParams;
  const categories = await getCatalog();
  return <Catalog categories={categories} added={params.added} />;
}
