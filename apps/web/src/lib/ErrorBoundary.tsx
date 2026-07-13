import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

function reportError(error: unknown, info: { componentStack?: string | null }) {
  // Centralized error reporting hook. Wire this up to Sentry, Datadog, etc.
  // For now, log to the console so the failure is visible during development
  // and can be picked up by any browser-side logger.
  // eslint-disable-next-line no-console
  console.error("[ErrorBoundary] Unhandled render error", { error, info });
}

function Fallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      role="alert"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"
    >
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-xl font-semibold text-rose-400">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          An unexpected error occurred while rendering the app.
        </p>
        <pre className="mt-4 max-h-48 overflow-auto rounded bg-slate-950/60 p-3 text-xs text-slate-300">
          {message}
        </pre>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="mt-4 rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={Fallback} onError={reportError}>
      {children}
    </ReactErrorBoundary>
  );
}
