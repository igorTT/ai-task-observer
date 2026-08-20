import { Navigate, type RouteObject } from "react-router-dom";
import { ApplicationShell, NotFoundPage, RouteErrorBoundary } from "@/app/routes";
import { IssueDetailPage } from "@/features/issues/issue-detail-page";
import { IssueListPage } from "@/features/issues/issue-list-page";
import { SessionPage } from "@/features/sessions/session-page";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <ApplicationShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/issues" replace /> },
      { path: "issues", element: <IssueListPage /> },
      { path: "issues/:issueId", element: <IssueDetailPage /> },
      { path: "sessions", element: <SessionPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
