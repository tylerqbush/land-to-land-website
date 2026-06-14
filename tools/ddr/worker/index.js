const GITHUB_REPO = "tylerqbush/land-to-land-website";
const GITHUB_WORKFLOW = "ddr.yml";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { apn, county, state, owner_name = "", size = "", subdivision = "" } = body;

    if (!apn || !county || !state) {
      return new Response(
        JSON.stringify({ error: "apn, county, and state are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const ghResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "DDR-Worker/1.0",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { apn, county, state, owner_name, size, subdivision },
        }),
      }
    );

    if (ghResp.status === 204) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const text = await ghResp.text();
    return new Response(JSON.stringify({ ok: false, error: text }), {
      status: ghResp.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  },
};
