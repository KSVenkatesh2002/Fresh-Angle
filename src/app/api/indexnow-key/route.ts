export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const requestedKey = searchParams.get("key");
  const configuredKey = process.env.INDEXNOW_KEY;

  if (!configuredKey || (requestedKey && requestedKey !== configuredKey)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(configuredKey, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
