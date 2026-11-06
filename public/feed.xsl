<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> | RSS Feed</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #f1f5f9;
            background-color: #090d16;
            margin: 0;
            padding: 24px;
            color-scheme: dark;
          }
          .container {
            max-width: 900px;
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
            margin-bottom: 28px;
          }
          .badge-rss {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            background: rgba(249, 115, 22, 0.15);
            color: #fb923c;
            border: 1px solid rgba(249, 115, 22, 0.3);
            margin-bottom: 12px;
          }
          h1 {
            color: #f8fafc;
            font-size: 26px;
            font-weight: 800;
            margin: 0 0 8px 0;
          }
          p.desc {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 16px 0;
          }
          .feed-banner {
            padding: 14px 18px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 10px;
            font-size: 13px;
            color: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          }
          .feed-banner a {
            color: #38bdf8;
            text-decoration: none;
            font-weight: 600;
          }
          .feed-banner a:hover {
            text-decoration: underline;
          }
          .items-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }
          .items-header h2 {
            font-size: 16px;
            font-weight: 700;
            color: #f8fafc;
            margin: 0;
          }
          .items-header span {
            font-size: 12px;
            color: #64748b;
          }
          .entry-card {
            border: 1px solid #1e293b;
            background: rgba(255, 255, 255, 0.01);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            transition: border-color 0.15s ease;
          }
          .entry-card:hover {
            border-color: #38bdf8;
            background: rgba(255, 255, 255, 0.02);
          }
          .entry-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .entry-cat {
            background: #1e293b;
            color: #38bdf8;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
          }
          .entry-title {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 8px 0;
          }
          .entry-title a {
            color: #f8fafc;
            text-decoration: none;
          }
          .entry-title a:hover {
            color: #60a5fa;
            text-decoration: underline;
          }
          .entry-desc {
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.6;
            margin: 0;
          }
          footer {
            margin-top: 32px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #1e293b;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="badge-rss">&#128225; RSS 2.0 Web Feed</div>
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <p class="desc"><xsl:value-of select="/rss/channel/description"/></p>
            <div class="feed-banner">
              <span>Looking for the interactive reader interface?</span>
              <a href="/rss">Browse RSS Syndication Hub &#8594;</a>
            </div>
          </header>

          <div class="items-header">
            <h2>Recent Syndicate Dispatches</h2>
            <span>Showing <xsl:value-of select="count(/rss/channel/item)"/> entries</span>
          </div>

          <div class="entries-list">
            <xsl:for-each select="/rss/channel/item">
              <div class="entry-card">
                <div class="entry-meta">
                  <span class="entry-cat"><xsl:value-of select="category"/></span>
                  <span>&#8226;</span>
                  <span><xsl:value-of select="pubDate"/></span>
                </div>
                <h3 class="entry-title">
                  <xsl:variable name="postLink">
                    <xsl:value-of select="link"/>
                  </xsl:variable>
                  <a href="{$postLink}" target="_blank">
                    <xsl:value-of select="title"/>
                  </a>
                </h3>
                <p class="entry-desc"><xsl:value-of select="description"/></p>
              </div>
            </xsl:for-each>
          </div>

          <footer>
            Generated automatically by Fresh Angle Autonomous Editorial Engine &#8226; RSS 2.0 Specification
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
