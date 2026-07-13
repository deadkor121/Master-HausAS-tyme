import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initApiBase } from "./lib/initApiBase";
import { ErrorBoundary } from "./lib/ErrorBoundary";
import { Loading } from "./components/Loading";
import { AuthProvider } from "./lib/AuthContext";
import "./styles.css";

// Explicit, side-effect-free bootstrap: resolve API base once before mounting.
initApiBase();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found in index.html");
}

// Module-scoped root so HMR can unmount and re-render cleanly.
let root: ReactDOM.Root | null = null;
function render(target: HTMLElement) {
  if (root) {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <React.Suspense fallback={<Loading />}>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </React.Suspense>
        </ErrorBoundary>
      </React.StrictMode>,
    );
    return;
  }
  root = ReactDOM.createRoot(target);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <React.Suspense fallback={<Loading />}>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </React.Suspense>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

render(container);

// Vite HMR: when this module is replaced, dispose of the existing root so a
// fresh one is created on the next render(). This prevents duplicate roots
// and stale subscriptions.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root?.unmount();
    root = null;
  });
}
