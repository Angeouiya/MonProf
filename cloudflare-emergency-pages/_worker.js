const COMPETENCE_ORIGIN = "https://www.competence.ci";

const emergencyProxy = {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, COMPETENCE_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-competence-emergency-proxy", "cloudflare-pages");

    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    const location = responseHeaders.get("location");

    if (location) {
      const redirectUrl = new URL(location, COMPETENCE_ORIGIN);
      if (redirectUrl.hostname === "competence.ci" || redirectUrl.hostname === "www.competence.ci") {
        redirectUrl.protocol = incomingUrl.protocol;
        redirectUrl.host = incomingUrl.host;
        responseHeaders.set("location", redirectUrl.toString());
      }
    }

    responseHeaders.set("x-competence-emergency-access", "cloudflare-pages");
    responseHeaders.set("x-robots-tag", "noindex, nofollow");
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

export default emergencyProxy;
