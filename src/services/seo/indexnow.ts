import { siteConfig } from '@/config/site';

export interface IndexNowResult {
  success: boolean;
  statusCode?: number;
  message: string;
}

export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { success: false, message: 'INDEXNOW_KEY not configured. Skipping ping.' };
  }

  const host = new URL(siteConfig.url).host;
  const keyLocation = `${siteConfig.url}/${key}.txt`;

  try {
    const payload = {
      host,
      key,
      keyLocation,
      urlList: urls.map((u) => (u.startsWith('http') ? u : `${siteConfig.url}${u}`)),
    };

    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 202) {
      console.log(`✓ [IndexNow] Successfully notified ${urls.length} URLs for indexing`);
      return { success: true, statusCode: res.status, message: 'URLs submitted to IndexNow' };
    }

    const errText = await res.text().catch(() => '');
    console.warn(`⚠️ [IndexNow] Failed with status ${res.status}: ${errText}`);
    return { success: false, statusCode: res.status, message: `IndexNow responded with status ${res.status}` };
  } catch (err) {
    const errMsg = (err as Error).message;
    console.warn(`⚠️ [IndexNow] Exception during ping: ${errMsg}`);
    return { success: false, message: errMsg };
  }
}
