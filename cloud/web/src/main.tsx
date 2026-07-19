import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { protectPrivateRoutesFromIndexing } from "./lib/indexing";
import "./styles.css";

protectPrivateRoutesFromIndexing();

const root = document.getElementById("root");
if (!root) throw new Error("BoundaryCI Cloud could not find its application root.");

const application = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, application);
else createRoot(root).render(application);
