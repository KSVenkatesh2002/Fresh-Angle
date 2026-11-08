import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { User, Globe, Image as ImageIcon, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "System Settings & Architecture Profiles",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          System & Creator Configuration
        </h1>
        <p className="text-sm text-foreground-muted">
          Global runtime variables, creator profile attribution, and search
          indexing properties.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Creator Attribution */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span>Creator Profile Attribution</span>
          </h2>
          {siteConfig.creator ? (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-muted border border-border">
              <div
                className="relative w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0"
                style={{ width: "64px", height: "64px" }}
              >
                <Image
                  src={siteConfig.creator.image}
                  alt={siteConfig.creator.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  {siteConfig.creator.name}
                </p>
                <a
                  href={siteConfig.creator.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {siteConfig.creator.url}
                </a>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  Asset: {siteConfig.creator.image}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-surface-muted border border-border text-xs text-foreground-muted">
              No creator profile configured. Provide <code>CREATOR_NAME</code>, <code>CREATOR_URL</code>, and <code>CREATOR_IMAGE</code> in environment variables to display creator attribution.
            </div>
          )}
          <p className="text-xs text-foreground-muted leading-relaxed">
            Standardized across all portfolio publications. Sourced from
            environment variables and site config.
          </p>
        </div>

        {/* Site Properties */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span>Site & Deployment Identity</span>
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
              <span className="text-foreground-muted">Site Name</span>
              <strong className="text-foreground">{siteConfig.name}</strong>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
              <span className="text-foreground-muted">Canonical Domain</span>
              <strong className="font-mono text-primary">
                {siteConfig.url}
              </strong>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
              <span className="text-foreground-muted">Default Timezone</span>
              <strong className="text-foreground">{siteConfig.timezone}</strong>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
              <span className="text-foreground-muted">Content Language</span>
              <strong className="text-foreground">{siteConfig.language}</strong>
            </div>
          </div>
        </div>

        {/* Image Storage & CDN Architecture */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4 md:col-span-2">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <span>Image Storage & CDN Architecture</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
              <span className="text-foreground-muted block font-medium">Storage Provider</span>
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span>Cloudinary CDN</span>
              </div>
              <p className="text-[11px] text-foreground-muted">
                Signed WebP uploads, responsive transforms, and edge CDN delivery.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
              <span className="text-foreground-muted block font-medium">Target Asset Folder</span>
              <div className="font-mono text-primary font-semibold">
                {process.env.CLOUDINARY_FOLDER || "fresh-angle/covers"}
              </div>
              <p className="text-[11px] text-foreground-muted">
                Deterministic keys: <code>{"{folder}/{yyyy}/{mm}/{slug}-{hash}"}</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
              <span className="text-foreground-muted block font-medium">Failure Fallback Strategy</span>
              <div className="font-mono text-foreground font-semibold">
                {process.env.IMAGE_FALLBACK || "default_image"}
              </div>
              <p className="text-[11px] text-foreground-muted">
                {process.env.IMAGE_FALLBACK === "draft"
                  ? "Post demoted to draft if image synthesis/upload fails."
                  : "Falls back to static branded cover in public/images/."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
