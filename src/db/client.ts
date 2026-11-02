import dns from 'node:dns';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Configure WebSocket constructor for Neon Serverless in Node.js environments
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

// Prefer IPv4 and filter out unreachable IPv6 addresses in containerized environments
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const origLookup = dns.lookup.bind(dns);
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number
) => void;

dns.lookup = function (
  hostname: string,
  options: dns.LookupOptions | number | LookupCallback,
  callback?: LookupCallback
): void {
  let cb: LookupCallback;
  let opts: dns.LookupOptions;

  if (typeof options === 'function') {
    cb = options;
    opts = { family: 4 };
  } else if (typeof options === 'object' && options !== null) {
    opts = { ...options, family: 4 };
    cb = callback as LookupCallback;
  } else {
    opts = { family: 4 };
    cb = callback as LookupCallback;
  }

  (
    origLookup as (
      h: string,
      o: dns.LookupOptions,
      c: (
        err: NodeJS.ErrnoException | null,
        address: string | dns.LookupAddress[],
        family: number
      ) => void
    ) => void
  )(
    hostname,
    opts,
    (
      err: NodeJS.ErrnoException | null,
      address: string | dns.LookupAddress[],
      family: number
    ) => {
      if (err) return cb(err, address, family);
      if (Array.isArray(address)) {
        const v4Only = address.filter((a) => a.family === 4);
        return cb(null, v4Only.length > 0 ? v4Only : address, family);
      }
      cb(err, address, family);
    }
  );
} as typeof dns.lookup;

// Lazy client instantiation to allow build-time imports without failing if DATABASE_URL is not set yet
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('❌ [Database Error] DATABASE_URL environment variable is missing.');
  }

  const pool = new Pool({ connectionString });
  dbInstance = drizzle(pool, { schema });
  return dbInstance;
}

// Image Storage abstraction interface
export interface ImageStorage {
  saveImage(params: {
    data: Buffer;
    mime?: string;
    width?: number;
    height?: number;
  }): Promise<string>;
  getImage(id: string): Promise<schema.PostImage | null>;
}

// Database-backed implementation of ImageStorage
export const dbImageStorage: ImageStorage = {
  async saveImage({ data, mime = 'image/webp', width = 1200, height = 630 }): Promise<string> {
    const db = getDb();
    const [inserted] = await db
      .insert(schema.postImages)
      .values({
        data,
        mime,
        width,
        height,
      })
      .returning({ id: schema.postImages.id });

    if (!inserted) {
      throw new Error('Failed to insert image into database');
    }

    return inserted.id;
  },

  async getImage(id: string): Promise<schema.PostImage | null> {
    const db = getDb();
    const result = await db.query.postImages.findFirst({
      where: (img, { eq }) => eq(img.id, id),
    });

    return result ?? null;
  },
};
