import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  const bucket = locals.runtime.env.CLOUD_FILES;
  const object = await bucket.get(key as string);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const data = await object.arrayBuffer();
  const contentType = object.httpMetadata?.contentType ?? "";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
    },
  });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return new Response(JSON.stringify({ success: false, error: "Missing key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bucket = locals.runtime.env.CLOUD_FILES;

  try {
    await bucket.delete(key as string);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return new Response(JSON.stringify({ success: false, error: "Failed to delete asset" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
