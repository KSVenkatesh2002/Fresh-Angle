import { siteConfig } from "@/config/site";

export async function GET(): Promise<Response> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${siteConfig.name}</ShortName>
  <Description>Search ${siteConfig.name} technical dispatches and AI intelligence</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" template="${siteConfig.url}/search?q={searchTerms}"/>
  <Image width="16" height="16" type="image/x-icon">${siteConfig.url}/favicon.ico</Image>
</OpenSearchDescription>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/opensearchdescription+xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
