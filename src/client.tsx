import { StartClient } from "@tanstack/react-start/client";
import { hydrateRoot } from "react-dom/client";
import { getRouter } from "./router";

const router = getRouter();

// Fallback for missing SSR bootstrap data
if (typeof window !== "undefined" && !(window as any).$_TSR) {
  (window as any).$_TSR = {
    matches: [],
    streamedValues: {},
    buffer: [],
    cleanups: [],
  };
}

// @ts-expect-error — StartClient typings in this version don't expose the router prop publicly
hydrateRoot(document, <StartClient router={router} />);
