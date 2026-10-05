import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceDetail } from "@/components/service-detail";
import { getCatalog, getService } from "@/lib/api";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await getCatalog();
    return categories.flatMap((category) => category.services.map((service) => ({ slug: service.slug })));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const service = await getService(slug);
    return {
      title: service.name,
      description: service.summary,
      openGraph: { title: service.name, description: service.summary, images: [service.photo] },
    };
  } catch {
    return { title: "Service" };
  }
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const service = await getService(slug);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      description: service.summary,
      provider: { "@type": "LocalBusiness", name: "brissiecardetailing", telephone: "+17142777003", url: "https://brissiecardetailing.com.au" },
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ServiceDetail service={service} />
      </>
    );
  } catch {
    notFound();
  }
}
