# Stage D Phase 0: Image Storage & Delivery Diagnosis

**Date:** 2026-11-08  
**Scope:** Read-only audit of current PostgreSQL image storage, database impact, delivery paths, and Cloudinary integration plan.

---

## 1. Current PostgreSQL Image Storage (`post_images`)

### Database Table Metrics (Queried via Neon PostgreSQL)
- **Table Name:** `public.post_images`
- **Total Image Rows:** `18`
- **Total Stored Binary Data:** `917,112 bytes` (~`895.6 KB`)
- **Average Image Size:** `50,951 bytes` (~`49.8 KB`)
- **Largest Image Size:** `123,896 bytes` (~`121.0 KB`)
- **Smallest Image Size:** `11,798 bytes` (~`11.5 KB`)
- **Table Disk Size on Neon:** `1,016 kB` (out of total `10 MB` database size).
- **Postgres Column Schema:**
  - `id`: `uuid` (Primary Key)
  - `data`: `bytea` (Binary WebP image data)
  - `mime`: `text` (e.g. `image/webp`)
  - `width`: `integer` (1200)
  - `height`: `integer` (630)
  - `created_at`: `timestamp with time zone`

### Neon Database Impact & Growth
- **Total Neon DB Size:** `10 MB` (`10,895,360 bytes`).
- **Disk Usage Share:** `post_images` consumes **~10% of total database storage** with only 18 images.
- **Estimated Growth Rate:**
  - At 7 posts/day @ ~60 KB WebP per post: **~420 KB/day** (~**12.6 MB/month**).
  - Storing binary blobs directly in PostgreSQL leads to table and WAL bloat, slow backup dumps, connection memory overhead, and unneeded database wakeups for media requests.

---

## 2. Every Reference to Image IDs, Tables, and Delivery in Codebase

| Component | File & Line | Usage Description |
| :--- | :--- | :--- |
| **Database Schema** | [`src/db/schema.ts:39-46`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/db/schema.ts#L39-L46) | Defines `postImages` table (`bytea` data). |
| **Posts Relation** | [`src/db/schema.ts:100`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/db/schema.ts#L100), [`643-645`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/db/schema.ts#L643-L645) | `posts.coverImageId` references `postImages.id`. |
| **Legacy DB Storage** | [`src/db/client.ts:109-138`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/db/client.ts#L109-L138) | `dbImageStorage.saveImage` (inserts bytea) & `dbImageStorage.getImage`. |
| **Serving Endpoint** | [`src/app/api/images/[id]/route.ts:1-35`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/app/api/images/[id]/route.ts#L1-L35) | Serves binary bytea directly from Neon via HTTP response. |
| **Open Graph & Twitter** | [`src/lib/seo/metadata.ts:25-27`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/lib/seo/metadata.ts#L25-L27) | Formats `${siteConfig.url}/api/images/${coverImageId}`. |
| **JSON-LD Schema** | [`src/lib/seo/jsonld.ts:53-55`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/lib/seo/jsonld.ts#L53-L55) | Formats `${siteConfig.url}/api/images/${post.coverImageId}`. |
| **XML Sitemap Images** | [`src/app/sitemap.xml/route.ts:46, 56`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/app/sitemap.xml/route.ts#L46) | Injects `<image:loc>${siteConfig.url}/api/images/${p.coverImageId}</image:loc>`. |
| **Blog Post Page** | [`src/app/(site)/blog/[slug]/page.tsx:125-126, 214-221`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/app/(site)/blog/[slug]/page.tsx#L125) | Renders Next `<Image src={'/api/images/' + post.coverImageId} />`. |
| **Post Cards (Home/Blog)** | [`src/components/blog/PostCard.tsx:19-20`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/components/blog/PostCard.tsx#L19-L20) | Renders Next `<Image src={'/api/images/' + post.coverImageId} />`. |
| **Related Posts** | [`src/components/blog/RelatedPosts.tsx:34-35`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/components/blog/RelatedPosts.tsx#L34-L35) | Renders Next `<Image src={'/api/images/' + post.coverImageId} />`. |
| **Pipeline Step (Save)** | [`src/services/pipeline/steps/save.ts:26-36, 62`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/services/pipeline/steps/save.ts#L26-L36) | Saves image buffer into DB via `dbImageStorage.saveImage` and links `coverImageId`. |
| **Cover Generators** | [`src/services/images/cover.ts:31-70`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/services/images/cover.ts#L31-L70) | Generates via Cloudflare AI (Flux-1) or Pexels, converted to WebP via Sharp. |
| **Next Config** | [`next.config.ts:7-19`](file:///home/dialedin/project/vercel/Fresh%20Angle/next.config.ts#L7-L19) | Configures `images.remotePatterns` (`images.pexels.com`, `freshangle.vercel.app`). |
| **Old R2 References** | [`src/lib/env.ts:23`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/lib/env.ts#L23) | `IMAGE_STORAGE: z.enum(["db", "r2"])` (to be removed). |

---

## 3. How Images Are Currently Served & Database Wakeups

### Live Request Inspection (`curl -sI https://freshangle.vercel.app/api/images/8cea26eb-937a-4776-a4bb-1af5acab6b26`)
```http
HTTP/2 200 
cache-control: public, max-age=31536000, immutable
content-type: image/webp
x-matched-path: /api/images/[id]
x-vercel-cache: MISS
content-length: 62812
```

### Analysis of Database Wakeup Issue:
- The route is configured with `export const dynamic = "force-dynamic"` ([`src/app/api/images/[id]/route.ts:4`](file:///home/dialedin/project/vercel/Fresh%20Angle/src/app/api/images/[id]/route.ts#L4)).
- Although headers include `Cache-Control: public, max-age=31536000, immutable`, Vercel edge edge-nodes across global regions initially register `x-vercel-cache: MISS`.
- **Every cache miss executes the Next.js serverless function, which connects to Neon Postgres (`SELECT * FROM post_images WHERE id = ...`) and transfers binary bytea over SQL connection**.
- When Neon is idle (serverless scale-to-zero), image requests wake up the Postgres compute instance simply to serve a JPEG/WebP cover!

---

## 4. Vercel Image Optimization Usage & Plan
- **Verification Status:** **UNVERIFIED** (No Vercel API management token with billing access is present in environment; only `VERCEL_OIDC_TOKEN` for deployment exists).
- **Vercel Hobby Plan Defaults:**
  - Standard Hobby plan includes **1,000 source images optimized per month**.
  - Current configuration uses `next/image` with `/api/images/[id]`. Because Next.js optimizes these on Vercel, every distinct device viewport and DPR requested consumes Vercel optimization credits.
- **Why Phase 2 Custom Cloudinary Loader is Essential:**
  By using a custom Cloudinary loader (`f_auto,q_auto,w_{width}`), the browser requests transformed images **directly from Cloudinary's global CDN**, completely bypassing Vercel Image Optimization. This protects Vercel Hobby plan limits and guarantees zero Vercel image overage fees.

---

## 5. Cloudinary Live Account Metrics (Direct API Audit)
Directly queried using the verified credentials:
- **Plan:** `Free`
- **Total Monthly Credits:** `25`
- **Credits Currently Used:** `0.12` (**0.48% used**)
- **Storage Used:** `128 MB` across `22` existing assets in the account.
- **Bandwidth Used:** `0 MB`
- **Transformation Credits Used:** `0`
- **Headroom:** Over **99.5%** of Cloudinary free monthly allowance is available.

---

## 6. Implementation Architecture Plan

1. **Storage Layer (`src/services/storage/cloudinary.ts`)**:
   - Single typed `ImageStorage` interface implementing `uploadCoverImage`, `deleteImage`, `getUsageStats`.
   - Strict Sharp transformation (1200x630 WebP, quality 85, stripped metadata).
   - Deterministic public ID: `fresh-angle/covers/{yyyy}/{mm}/{slug}-{short-hash}`.
   - Nullable `data` in DB; new posts write `cover_image_url` directly to Cloudinary.
2. **Delivery Layer (`src/components/ui/CloudinaryImage.tsx` / Custom Loader)**:
   - Fixed list of 4 optimized widths: `[384, 640, 896, 1200]`.
   - Update `next.config.ts` remotePatterns to allow `res.cloudinary.com`.
3. **Migration Script (`scripts/migrate-images.ts`)**:
   - Reads existing bytea images from `post_images`, uploads each to Cloudinary with verification.
   - Updates `post_images.public_url` and redirects `/api/images/[id]` with HTTP 301.
   - Standalone `--purge-db-bytes` command to nullify `data` after 100% verification.
4. **Admin Usage & Health**:
   - Add Cloudinary usage metrics card to `/admin/usage`.

