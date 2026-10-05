export type Bullet = { group?: string; text: string };

export type CatalogService = {
  name: string;
  slug: string;
  summary: string;
  paragraphs: string[];
  bullets: Bullet[];
  warnings: string[];
  photo: string;
  depositCents: number;
  isAddon: boolean;
  requiresDropoff: boolean;
  options: {
    name: string;
    priceCents: number;
    durationMinutes: number;
    priceOnRequest?: boolean;
  }[];
};

export type CatalogCategory = {
  name: string;
  slug: string;
  services: CatalogService[];
};

const liability =
  "By booking an appointment the customer authorizes brissiecardetailing to perform the services listed. The vehicle is visually inspected at check-in. brissiecardetailing is not responsible for pre-existing damage, mechanical or electrical issues, warning lights, or concerns related to prior repairs or overall vehicle condition.";

const belongings =
  "Please remove all personal belongings and valuables from the vehicle before your appointment.";

const extraFee =
  "Excessive pet hair, sand, or heavy staining will require an additional fee ($30–$90) based on the extra time needed. That fee is collected when the job is finished.";

const depositNote =
  "A deposit is required to secure the appointment. The rest is due when the job is finished. All deposits are non-refundable.";

const exterior = [
  "Pre-wash treatment: safely removes bugs, dirt, and road grime.",
  "100% hand wash: a gentle clean with a scratch-free finish.",
  "Wheel, tire, and suspension: wheels, tires, brake calipers, wheel liners, and suspension parts.",
  "Gas cap and exhaust cleaning.",
  "Tire treatment for a clean, finished look.",
  "Ceramic spray wax on paint, door jambs, wheels, and windows. Deep gloss, hydrophobic protection, and UV protection for 3–4 months.",
];

const lightInterior = [
  "Blowout: compressed air clears dust from hard-to-reach areas.",
  "Full vacuum of floors and seats, with carpet brushing.",
  "Aesthetic carpet lines.",
  "Rubber mat care: mats deep cleaned and conditioned.",
  "Surface scrub of plastics, leather, cup holders, and air vents.",
  "Interior conditioning: ceramic-based conditioner on plastics and leather for UV protection.",
  "Final touches: windows and door jambs cleaned, air freshener provided.",
];

export const catalog: CatalogCategory[] = [
  {
    name: "Standard Detail",
    slug: "standard-detail",
    services: [
      {
        name: "Standard Exterior Detail",
        slug: "standard-exterior-detail",
        summary:
          "($55 – $65) A good daily driver package. Simple vacuum, hand wash, and scrubdown.",
        paragraphs: [
          "A maintenance wash for a daily driver. The outside is washed by hand, the wheels and tires are cleaned, and a ceramic spray wax is applied for gloss and protection.",
          depositNote,
        ],
        bullets: [
          { group: "Exterior", text: exterior[0] },
          { group: "Exterior", text: exterior[1] },
          { group: "Exterior", text: exterior[2] },
          { group: "Exterior", text: exterior[3] },
          { group: "Exterior", text: exterior[4] },
          { group: "Exterior", text: exterior[5] },
        ],
        warnings: [belongings, extraFee, liability],
        photo: "/photos/standard-exterior-detail.jpg",
        depositCents: 4000,
        isAddon: false,
        requiresDropoff: false,
        options: [
          { name: "Sedan / coupe", priceCents: 5500, durationMinutes: 30 },
          { name: "suv/truck", priceCents: 6000, durationMinutes: 40 },
          { name: "large suv", priceCents: 6500, durationMinutes: 45 },
        ],
      },
      {
        name: "Standard Detail",
        slug: "standard-detail-package",
        summary:
          "($90 – $110) A good daily driver package. Simple vacuum, hand wash, and scrubdown, inside and out.",
        paragraphs: [
          "The same careful exterior wash as the exterior package, plus a full light interior clean: vacuum, mats, surface scrub, and interior conditioning.",
          depositNote,
        ],
        bullets: [
          ...exterior.map((text) => ({ group: "Exterior", text })),
          ...lightInterior.map((text) => ({ group: "Interior", text })),
        ],
        warnings: [belongings, extraFee, liability],
        photo: "/photos/standard-detail.jpg",
        depositCents: 4000,
        isAddon: false,
        requiresDropoff: false,
        options: [
          { name: "Sedan / coupe", priceCents: 9000, durationMinutes: 90 },
          { name: "suv/truck", priceCents: 10000, durationMinutes: 105 },
          { name: "large suv", priceCents: 11000, durationMinutes: 120 },
        ],
      },
    ],
  },
  {
    name: "Full detail",
    slug: "full-detail",
    services: [
      {
        name: "Full detail",
        slug: "full-detail-package",
        summary:
          "($290 – $310) A full vehicle restoration package, including clay bar, shampooing, steam clean, and wax.",
        paragraphs: [
          "A restoration detail. The paint is decontaminated and clayed, then protected with graphene spray wax. The interior is steamed, scrubbed, and extracted.",
          depositNote,
        ],
        bullets: [
          { group: "Exterior", text: "Alkaline pre-wash to remove old waxes, sealants, bugs, and tree sap." },
          { group: "Exterior", text: "100% hand wash for a gentle, scratch-free finish." },
          { group: "Exterior", text: "Iron remover to dissolve embedded iron particles from the paint." },
          { group: "Exterior", text: "Clay bar treatment to remove contaminants and light water spots." },
          { group: "Exterior", text: "Wheel, tire, and suspension deep clean." },
          { group: "Exterior", text: "Gas cap and exhaust cleaning." },
          { group: "Exterior", text: "Tire treatment for a finished look." },
          { group: "Exterior", text: "Graphene spray wax on paint, door jambs, wheels, and windows. Hydrophobic protection and UV protection for about 8 months." },
          { group: "Interior", text: "Blowout with compressed air." },
          { group: "Interior", text: "Full vacuum of floors and seats." },
          { group: "Interior", text: "Steam clean and sanitize of plastics, leather, cup holders, buttons, and vents." },
          { group: "Interior", text: "Full surface scrub for deeper stains." },
          { group: "Interior", text: "Leather treatment and interior plastic treatment." },
          { group: "Interior", text: "Carpet and seat extraction: shampoo, steam, and machine extraction." },
          { group: "Interior", text: "Peroxide treatment so fabrics feel fresh." },
          { group: "Interior", text: "Windows, door jambs, and rubber mats cleaned." },
        ],
        warnings: [belongings, extraFee, liability],
        photo: "/photos/full-detail.jpg",
        depositCents: 4000,
        isAddon: false,
        requiresDropoff: false,
        options: [
          { name: "Sedan / coupe", priceCents: 29000, durationMinutes: 180 },
          { name: "suv/truck", priceCents: 30000, durationMinutes: 210 },
          { name: "large suv", priceCents: 31000, durationMinutes: 240 },
        ],
      },
    ],
  },
  {
    name: "paint enhancement",
    slug: "paint-enhancement",
    services: [
      {
        name: "Clay And Seal / Maintenance Ceramic Coating",
        slug: "clay-and-seal",
        summary:
          "($160 – $180) Clay bar, decontamination, and graphene sealant, with a light interior clean.",
        paragraphs: [
          "Paint decontamination and a graphene sealant that can stand alone or boost an existing ceramic coating, plus a maintenance interior clean.",
          depositNote,
        ],
        bullets: [
          { group: "Exterior", text: "Safe alkaline pre-wash for coated paint, bugs, and tree sap." },
          { group: "Exterior", text: "100% hand wash." },
          { group: "Exterior", text: "Iron remover and clay bar treatment." },
          { group: "Exterior", text: "Wheel, tire, and suspension deep clean." },
          { group: "Exterior", text: "Gas cap and exhaust cleaning, plus tire treatment." },
          { group: "Exterior", text: "Graphene spray wax for gloss, hydrophobic protection, and UV protection for about 8 months." },
          ...lightInterior.map((text) => ({ group: "Interior", text })),
        ],
        warnings: [belongings, extraFee, liability],
        photo: "/photos/clay-and-seal.jpg",
        depositCents: 4000,
        isAddon: false,
        requiresDropoff: false,
        options: [
          { name: "Sedan / coupe", priceCents: 16000, durationMinutes: 60 },
          { name: "suv/truck", priceCents: 17000, durationMinutes: 75 },
          { name: "large suv", priceCents: 18000, durationMinutes: 90 },
        ],
      },
      {
        name: "Wheels-Off & Caliper Ceramic Coating",
        slug: "wheels-off-caliper-ceramic",
        summary:
          "Comprehensive 360° ceramic protection for your wheels, barrels, and brake calipers.",
        paragraphs: [
          "All four wheels come off so the faces, inner barrels, and calipers can be coated. This service requires vehicle drop-off and pairs well with a ceramic coating package.",
          depositNote,
        ],
        bullets: [
          { text: "Vehicle safely lifted using heavy-duty jacks and stands." },
          { text: "All 4 wheels removed for iron decontamination and tar removal." },
          { text: "Wheels, inner barrels, and brake calipers prepped with an IPA panel wipe." },
          { text: "Professional 5-year ceramic coating on wheel faces, inner barrels, and brake calipers." },
          { text: "Wheels torqued back to factory specs." },
          { text: "Brake dust and heat resistance, easier rinsing, and protection against oxidation and pitting." },
        ],
        warnings: [
          belongings,
          "This service requires vehicle drop-off.",
          liability,
        ],
        photo: "/photos/wheels-off-caliper-ceramic.jpg",
        depositCents: 4000,
        isAddon: false,
        requiresDropoff: true,
        options: [{ name: "All vehicles", priceCents: 25000, durationMinutes: 60 }],
      },
      {
        name: "stage 1 Ceramic Coating",
        slug: "stage-1-ceramic-coating",
        summary:
          "For daily drivers and well-maintained cars that want deep gloss and protection without a multi-stage correction.",
        paragraphs: [
          "A light one-step machine polish, then a 4–5 year ceramic coating on painted panels. The final service price is confirmed from the vehicle’s condition. The deposit secures the day.",
          "This service requires vehicle drop-off. The vehicle cannot be washed until 7 days after the coating.",
          "A $100 deposit is required. All deposits are non-refundable.",
        ],
        bullets: [
          { text: "100% hand wash." },
          { text: "Iron remover and clay bar treatment." },
          { text: "Wheel, tire, and suspension deep clean, plus gas cap cleaning." },
          { text: "1-step paint correction to clear oxidation and light haze and improve clarity." },
          { text: "4–5 year ceramic coating, a single professional layer on painted body panels." },
        ],
        warnings: [
          belongings,
          "This service requires vehicle drop-off.",
          "After the ceramic coating, the vehicle cannot be washed until 7 days later.",
          liability,
        ],
        photo: "/photos/stage-1-ceramic-coating.jpg",
        depositCents: 10000,
        isAddon: false,
        requiresDropoff: true,
        options: [
          { name: "Sedan / coupe", priceCents: 0, durationMinutes: 480, priceOnRequest: true },
          { name: "suv/truck", priceCents: 0, durationMinutes: 480, priceOnRequest: true },
          { name: "large suv", priceCents: 0, durationMinutes: 540, priceOnRequest: true },
        ],
      },
    ],
  },
  {
    name: "Off-road Package",
    slug: "off-road-package",
    services: [
      {
        name: "Off-Road Reset Detail",
        slug: "off-road-reset-detail",
        summary:
          "($150.00 – $200.00) High-efficiency wash, undercarriage flush, engine bay detail, and ceramic foam reset for rigs fresh off the dirt, sand, or trail.",
        paragraphs: [
          "A reset for a vehicle that just came off the dirt. The undercarriage and engine bay are cleaned, then the exterior and a light interior are finished with ceramic spray protection.",
          depositNote,
        ],
        bullets: [
          { group: "Exterior & undercarriage", text: "Engine bay deep clean and dress: foam, agitation, rinse, and a non-sticky UV dressing." },
          { group: "Exterior & undercarriage", text: "Undercarriage and frame flush of the frame, control arms, shocks, differential, and wheel wells." },
          ...exterior.map((text) => ({ group: "Exterior & undercarriage", text })),
          ...lightInterior.map((text) => ({ group: "Interior", text })),
        ],
        warnings: [
          belongings,
          "Excessive heavy mud, sand, or heavy staining will require an additional fee ($50–$75) based on the extra time needed.",
          liability,
        ],
        photo: "/photos/off-road-reset-detail.jpg",
        depositCents: 4000,
        isAddon: false,
        requiresDropoff: false,
        options: [
          { name: "Sedan / coupe", priceCents: 15000, durationMinutes: 90 },
          { name: "suv/truck", priceCents: 17500, durationMinutes: 120 },
          { name: "large suv", priceCents: 20000, durationMinutes: 150 },
        ],
      },
    ],
  },
  {
    name: "Other",
    slug: "other",
    services: [
      {
        name: "Engine Bay Deep Clean & Dress",
        slug: "engine-bay-deep-clean",
        summary: "($50.00) Deep degreasing, a component blowout, and a non-greasy dressing.",
        paragraphs: [
          "This is an add-on. It cannot be booked on its own and must be paired with a main detail package.",
        ],
        bullets: [
          { text: "Deep degreasing to remove baked-on oil, road grime, and debris." },
          { text: "Component blowout to clear trapped water from sensitive areas." },
          { text: "Premium dressing on plastics and hoses for a factory-fresh, non-greasy shine." },
        ],
        warnings: [
          "This is an add-on service only. It cannot be booked standalone and must be paired with one of the main detail packages.",
          "Engine bays contain sensitive electrical components. brissiecardetailing uses low-pressure techniques and blows out moisture, and is not responsible for pre-existing electrical issues, faulty wiring, unprotected aftermarket electronics, or water intrusion from degraded seals.",
        ],
        photo: "/photos/engine-bay-deep-clean.jpg",
        depositCents: 4000,
        isAddon: true,
        requiresDropoff: false,
        options: [{ name: "Engine bay", priceCents: 5000, durationMinutes: 30 }],
      },
      {
        name: "Premium Headlight Restoration",
        slug: "premium-headlight-restoration",
        summary:
          "($80.00) Strips heavy oxidation so the headlights project light the way they should.",
        paragraphs: [
          "This is an add-on. It cannot be booked on its own and must be paired with a main detail package.",
        ],
        bullets: [
          { text: "Multi-stage wet sanding to strip heavy yellow oxidation and cloudiness." },
          { text: "Machine compound and polish to restore lens clarity." },
          { text: "Ceramic UV blocker to seal the lens and slow fading." },
        ],
        warnings: [
          "This is an add-on service only. It cannot be booked standalone and must be paired with one of the main detail packages.",
          "This process restores the exterior surface of the lens only. brissiecardetailing is not responsible for pre-existing internal moisture, micro-cracking, or fading on the inside of the housing.",
        ],
        photo: "/photos/premium-headlight-restoration.jpg",
        depositCents: 4000,
        isAddon: true,
        requiresDropoff: false,
        options: [{ name: "Pair of headlights", priceCents: 8000, durationMinutes: 60 }],
      },
      {
        name: "Heavy Pet Hair & Sand Extraction",
        slug: "heavy-pet-hair-sand-extraction",
        summary:
          "($50.00 – $90.00) Air purge, mechanical brushing, and extra time for hair and beach sand woven into the fabrics.",
        paragraphs: [
          "This is an add-on. It cannot be booked on its own and must be paired with a main detail package.",
        ],
        bullets: [
          { text: "Specialized air purge for hair and sand in crevices and carpet fibers." },
          { text: "Mechanical brushing and vacuum extraction for woven-in debris." },
          { text: "Extended time dedicated to the fabrics." },
        ],
        warnings: [
          "This is an add-on service only. It cannot be booked standalone and must be paired with one of the main detail packages.",
          "Severe extraction uses aggressive brushing and high-pressure air. brissiecardetailing is not responsible for fraying or thinning of fibers caused by pre-existing wear, age, or sun damage.",
        ],
        photo: "/photos/heavy-pet-hair-sand-extraction.jpg",
        depositCents: 4000,
        isAddon: true,
        requiresDropoff: false,
        options: [
          { name: "Standard extraction", priceCents: 5000, durationMinutes: 60 },
          { name: "Heavy extraction", priceCents: 9000, durationMinutes: 60 },
        ],
      },
    ],
  },
];

export const cancellationPolicy =
  "Deposits are non-refundable. This appointment cannot be canceled or rescheduled after booking once the cancellation window has passed. By booking, you agree to the deposit and to paying the remaining balance when the job is finished.";
