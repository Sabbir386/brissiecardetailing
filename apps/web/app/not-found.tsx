import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <h1>That page is not on the menu</h1>
      <Link href="/">Back to services</Link>
    </div>
  );
}
