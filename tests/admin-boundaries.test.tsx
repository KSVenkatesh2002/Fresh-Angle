import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminNotFound from "@/app/admin/not-found";
import AdminError from "@/app/admin/error";

describe("Admin Error & Not-Found Boundaries (Local Isolation Test)", () => {
  it("renders AdminNotFound without leaking the public site Header or navigation", () => {
    const html = renderToStaticMarkup(<AdminNotFound />);

    // Must contain admin-specific 404 messaging
    expect(html).toContain("Admin 404");
    expect(html).toContain("Admin Page Not Found");
    expect(html).toContain("Mission Control Dashboard");

    // Must NOT contain public site header elements
    expect(html).not.toContain("AI &amp; TECH INTEL");
    expect(html).not.toContain("Join Telegram");
    expect(html).not.toContain("Return to Homepage");
    expect(html).not.toContain("<header");
  });

  it("renders AdminError without leaking the public site Header or navigation", () => {
    const html = renderToStaticMarkup(
      <AdminError
        error={new Error("Simulated admin telemetry fault")}
        reset={() => {}}
      />,
    );

    // Must contain admin-specific error messaging
    expect(html).toContain("Admin Runtime Error");
    expect(html).toContain("Mission Control Error");
    expect(html).toContain("Retry Operation");

    // Must NOT contain public site header elements
    expect(html).not.toContain("AI &amp; TECH INTEL");
    expect(html).not.toContain("Join Telegram");
    expect(html).not.toContain("<header");
  });
});

