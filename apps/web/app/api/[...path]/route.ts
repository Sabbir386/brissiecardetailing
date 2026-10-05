import { NextRequest } from "next/server";

const base = process.env.API_INTERNAL_URL || "http://localhost:4000";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${base}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  });
  const outgoing = new Headers();
  const type = response.headers.get("content-type");
  if (type) outgoing.set("content-type", type);
  for (const cookieHeader of response.headers.getSetCookie()) outgoing.append("set-cookie", cookieHeader);
  return new Response(await response.arrayBuffer(), { status: response.status, headers: outgoing });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
