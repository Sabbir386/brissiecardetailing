export type Bullet = { group?: string; text: string };

export type ServiceOption = {
  id: string;
  name: string;
  priceCents: number;
  priceLabel: string;
  durationMinutes: number;
  durationLabel: string;
  priceOnRequest: boolean;
};

export type Service = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  paragraphs: string[];
  bullets: Bullet[];
  warnings: string[];
  photo: string;
  depositCents: number;
  depositLabel: string;
  isAddon: boolean;
  requiresDropoff: boolean;
  priceLine: string;
  durationMinutes: number;
  options: ServiceOption[];
  category?: { name: string; slug: string };
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  services: Service[];
};

export type Hour = {
  dayOfWeek: number;
  label: string;
  closed: boolean;
  open: string;
  close: string;
};

export type Business = {
  name: string;
  phone: string;
  phoneTel: string;
  locationLine: string;
  timezone: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  cancellationPolicy: string;
  openUntilLabel: string;
  hours: Hour[];
};

export type CartItem = {
  serviceId: string;
  slug: string;
  serviceName: string;
  optionId: string;
  optionName: string;
  priceCents: number;
  durationMinutes: number;
  isAddon: boolean;
  requiresDropoff: boolean;
  priceOnRequest: boolean;
  depositCents: number;
  priceLabel: string;
  photo?: string;
};

export type Quote = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number | null;
  durationMinutes: number;
  priceOnRequest: boolean;
};

export type Hold = {
  id: string;
  date: string;
  time: string;
  endTime: string;
  label: string;
  expiresAt: string;
  items: CartItem[];
  quote: Quote;
};

export type Booking = {
  id: string;
  token: string;
  status: string;
  label: string;
  date: string;
  address: string;
  note: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number | null;
  priceOnRequest: boolean;
  devPayment: boolean;
  cardSaved: boolean;
  items: {
    serviceName: string;
    optionName: string;
    priceCents: number;
    requiresDropoff: boolean;
    priceOnRequest: boolean;
    isAddon: boolean;
  }[];
  customer: { firstName: string | null; lastName: string | null; email: string | null; phone: string };
};

export type Availability = {
  timezone: string;
  durationMinutes: number;
  days: { date: string; slots: string[] }[];
};
