import { Activity } from "lucide-react";
import { NavLink, Outlet, useRouteError } from "react-router-dom";
import { OperationsPanel } from "@/features/operations/operations-panel";

export function ApplicationShell() {
  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/issues" className="brand">
          <Activity aria-hidden="true" className="text-primary" />
          <span>
            <strong>AI Task Observer</strong>
            <small>Local usage accounting</small>
          </span>
        </NavLink>
        <nav aria-label="Primary navigation" className="primary-nav">
          <NavLink to="/issues">Issues</NavLink>
          <NavLink to="/sessions">Sessions</NavLink>
        </nav>
        <div className="header-actions">
          <OperationsPanel />
        </div>
      </header>
      <main id="main-content" className="page">
        <Outlet />
      </main>
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  return (
    <section>
      <p className="eyebrow">Dashboard error</p>
      <h1>Something went wrong</h1>
      <p className="mt-3 text-slate-600">
        The route could not be displayed. Return to the issue overview and try again.
      </p>
      <a className="safe-link mt-4" href="/issues">
        Go to issue usage
      </a>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="mt-4 overflow-auto rounded bg-slate-100 p-4 text-xs">{error.message}</pre>
      )}
    </section>
  );
}
export function NotFoundPage() {
  return (
    <section>
      <p className="eyebrow">Not found</p>
      <h1>That dashboard page does not exist</h1>
      <a className="safe-link mt-4" href="/issues">
        Go to issue usage
      </a>
    </section>
  );
}
