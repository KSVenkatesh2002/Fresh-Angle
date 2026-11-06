<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title>XML Sitemap | Fresh Angle</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background-color: #090d16;
            margin: 0;
            padding: 24px;
            color-scheme: dark;
          }
          .container {
            max-width: 1100px;
            margin: 0 auto;
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          }
          header {
            border-bottom: 1px solid #1e293b;
            padding-bottom: 24px;
            margin-bottom: 24px;
          }
          h1 {
            color: #f8fafc;
            font-size: 26px;
            font-weight: 700;
            margin: 0 0 8px 0;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          p.desc {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 16px 0;
          }
          .stats {
            display: inline-flex;
            gap: 16px;
            font-size: 13px;
            color: #38bdf8;
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.2);
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: 600;
          }
          .html-sitemap-banner {
            margin-top: 16px;
            padding: 12px 16px;
            background: #1e293b;
            border-radius: 8px;
            font-size: 13px;
            color: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .html-sitemap-banner a {
            color: #38bdf8;
            text-decoration: none;
            font-weight: 600;
          }
          .html-sitemap-banner a:hover {
            text-decoration: underline;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
            margin-top: 16px;
          }
          th {
            background-color: #1e293b;
            color: #94a3b8;
            padding: 12px 14px;
            font-weight: 600;
            border-bottom: 2px solid #334155;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
          }
          td {
            padding: 12px 14px;
            border-bottom: 1px solid #1e293b;
            color: #cbd5e1;
            vertical-align: middle;
          }
          tr:hover td {
            background-color: rgba(255, 255, 255, 0.03);
          }
          td a {
            color: #60a5fa;
            text-decoration: none;
            word-break: break-all;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12px;
          }
          td a:hover {
            color: #93c5fd;
            text-decoration: underline;
          }
          .badge-freq {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            background: #1e293b;
            color: #94a3b8;
            border: 1px solid #334155;
            text-transform: capitalize;
          }
          .badge-prio {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            background: rgba(34, 197, 94, 0.15);
            color: #4ade80;
            border: 1px solid rgba(34, 197, 94, 0.3);
          }
          footer {
            margin-top: 24px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>&#10022; Fresh Angle XML Sitemap</h1>
            <p class="desc">
              This is a stylized XML sitemap generated for search engines (Google, Bing, Yandex) and crawlers.
            </p>
            <div class="stats">
              <span>Total URLs Indexed: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span>
            </div>
            <div class="html-sitemap-banner">
              <span>Looking for the human-friendly navigation directory?</span>
              <a href="/sitemap">Browse Full HTML Sitemap &#8594;</a>
            </div>
          </header>

          <table>
            <thead>
              <tr>
                <th style="width: 55%;">URL Location</th>
                <th style="width: 15%;">Change Frequency</th>
                <th style="width: 10%;">Priority</th>
                <th style="width: 20%;">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td>
                    <xsl:variable name="itemURL">
                      <xsl:value-of select="sitemap:loc"/>
                    </xsl:variable>
                    <a href="{$itemURL}">
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                  </td>
                  <td>
                    <span class="badge-freq">
                      <xsl:value-of select="sitemap:changefreq"/>
                    </span>
                  </td>
                  <td>
                    <span class="badge-prio">
                      <xsl:value-of select="sitemap:priority"/>
                    </span>
                  </td>
                  <td style="color: #94a3b8; font-family: ui-monospace, monospace; font-size: 12px;">
                    <xsl:value-of select="sitemap:lastmod"/>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <footer>
            Generated automatically by Fresh Angle Autonomous Editorial Engine &#8226; RFC 5005 &amp; Sitemaps XML Protocol 0.9
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
