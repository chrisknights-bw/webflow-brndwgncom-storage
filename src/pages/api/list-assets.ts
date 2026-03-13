import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, locals }) => {
try {
    // Check if bucket is available
    const bucket = locals.runtime.env.CLOUD_FILES;
    if (!bucket) {
    return new Response("Cloud storage not configured", { status: 500 });
    }

    const options = { limit: 500 };
    const listed = await bucket.list(options);
    let truncated = listed.truncated;

    // Paging through the files
    // @ts-ignore
    let cursor = truncated ? listed.cursor : undefined;

    while (truncated) {
    const next = await bucket.list({
        ...options,
        cursor: cursor,
    });
    listed.objects.push(...next.objects);

    truncated = next.truncated;
    // @ts-ignore
    cursor = next.cursor;
    }

    // Return the files as a JSON object
    return new Response(JSON.stringify(listed.objects), {
    headers: { "Content-Type": "application/json" },
    });
} catch (error) {
    console.error("Error listing assets:", error);
    return new Response("Failed to list assets", { status: 500 });
}
};