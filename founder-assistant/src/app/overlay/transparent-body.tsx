"use client";

import { useEffect } from "react";

export function TransparentBody() {
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  return null;
}
