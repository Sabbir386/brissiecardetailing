export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function durationPhrase(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours} hr ${mins} min`;
  if (hours) return `${hours} hr`;
  return `${mins} min`;
}

export function vehicleLabel(name: string) {
  const key = name.trim().toLowerCase();
  if (key === "sedan / coupe") return "Sedan, Coupe";
  if (key === "suv/truck") return "SUV";
  if (key === "large suv") return "Truck, Large SUV";
  return name;
}

export function clockLabel(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length >= 10) {
    let national = digits.slice(2);
    if (national.startsWith("0")) national = national.slice(1);
    if (national.length >= 9) {
      return `+61 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
    }
    return `+61 ${national}`;
  }
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (phone.startsWith("+") && digits.length > 8) {
    const ccLen = digits.length - 10;
    const cc = digits.slice(0, Math.max(ccLen, 1));
    const rest = digits.slice(cc.length);
    return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim();
  }
  return phone;
}

export const states = ["QLD", "NSW", "VIC", "WA", "SA", "TAS", "ACT", "NT"];

export const countries = [
  { name: "Australia", code: "AU", dial: "+61" },
  { name: "United States", code: "US", dial: "+1" },
  { name: "Canada", code: "CA", dial: "+1" },
  { name: "United Kingdom", code: "GB", dial: "+44" },
  { name: "New Zealand", code: "NZ", dial: "+64" },
  { name: "India", code: "IN", dial: "+91" },
  { name: "Philippines", code: "PH", dial: "+63" },
];
