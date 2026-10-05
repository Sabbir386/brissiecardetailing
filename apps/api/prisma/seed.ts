import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cancellationPolicy, catalog } from "./catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.business.upsert({
    where: { id: "main" },
    update: {
      name: "brissiecardetailing",
      phone: "(714) 277-7003",
      phoneTel: "+17142777003",
      locationLine: "We'll come to you!",
      timezone: "America/Los_Angeles",
      instagramUrl: "https://www.instagram.com/brissiecardetailing",
      facebookUrl: "https://www.facebook.com/brissiecardetailing",
      cancellationPolicy,
    },
    create: {
      id: "main",
      name: "brissiecardetailing",
      phone: "(714) 277-7003",
      phoneTel: "+17142777003",
      locationLine: "We'll come to you!",
      timezone: "America/Los_Angeles",
      instagramUrl: "https://www.instagram.com/brissiecardetailing",
      facebookUrl: "https://www.facebook.com/brissiecardetailing",
      cancellationPolicy,
    },
  });

  for (let day = 0; day < 7; day++) {
    await prisma.weeklyHour.upsert({
      where: { dayOfWeek: day },
      update: { openMin: 7 * 60, closeMin: 19 * 60, closed: false },
      create: { dayOfWeek: day, openMin: 7 * 60, closeMin: 19 * 60, closed: false },
    });
  }

  for (const [categoryIndex, category] of catalog.entries()) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: categoryIndex },
      create: { name: category.name, slug: category.slug, sortOrder: categoryIndex },
    });
    for (const [serviceIndex, service] of category.services.entries()) {
      const saved = await prisma.service.upsert({
        where: { slug: service.slug },
        update: {
          categoryId: savedCategory.id,
          name: service.name,
          summary: service.summary,
          paragraphs: service.paragraphs,
          bullets: service.bullets,
          warnings: service.warnings,
          photo: service.photo,
          depositCents: service.depositCents,
          isAddon: service.isAddon,
          requiresDropoff: service.requiresDropoff,
          sortOrder: serviceIndex,
        },
        create: {
          categoryId: savedCategory.id,
          name: service.name,
          slug: service.slug,
          summary: service.summary,
          paragraphs: service.paragraphs,
          bullets: service.bullets,
          warnings: service.warnings,
          photo: service.photo,
          depositCents: service.depositCents,
          isAddon: service.isAddon,
          requiresDropoff: service.requiresDropoff,
          sortOrder: serviceIndex,
        },
      });
      await prisma.serviceOption.deleteMany({ where: { serviceId: saved.id } });
      await prisma.serviceOption.createMany({
        data: service.options.map((option, index) => ({
          serviceId: saved.id,
          name: option.name,
          priceCents: option.priceCents,
          durationMinutes: option.durationMinutes,
          priceOnRequest: Boolean(option.priceOnRequest),
          sortOrder: index,
        })),
      });
    }
  }

  const email = "admin@brissiecardetailing.local";
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "silvas-admin", 10);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
