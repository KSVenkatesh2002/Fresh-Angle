import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PostCreator } from "@/components/admin/PostCreator";

export const metadata: Metadata = {
  title: "Create & Schedule Dispatch",
  robots: { index: false, follow: false },
};

export default async function AdminNewPostPage(): Promise<React.JSX.Element> {
  const db = getDb();
  const categoriesList = await db.query.categories.findMany({
    orderBy: [asc(categories.name)],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Create & Schedule New Dispatch
        </h1>
        <p className="text-sm text-foreground-muted">
          Generate an immediate briefing with custom guidance, create manual
          drafts, or schedule future publications.
        </p>
      </div>

      <PostCreator categories={categoriesList} />
    </div>
  );
}
