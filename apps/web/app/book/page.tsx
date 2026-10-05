import type { Metadata } from "next";
import { CalendarBook } from "@/components/calendar";

export const metadata: Metadata = {
  title: "Choose a time",
  robots: { index: false, follow: false },
};

export default function BookPage() {
  return <CalendarBook />;
}
