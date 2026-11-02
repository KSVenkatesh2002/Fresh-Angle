"use client";

import React, { useEffect, useState } from "react";

export function ReadingProgressBar(): React.JSX.Element {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    function updateProgress(): void {
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const scrolled = (window.scrollY / scrollHeight) * 100;
        setProgress(Math.min(100, Math.max(0, scrolled)));
      }
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Article reading progress"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-primary transition-all duration-75 ease-out shadow-sm"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
