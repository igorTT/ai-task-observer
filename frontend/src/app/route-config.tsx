import type { RouteObject } from "react-router-dom";

import { ApplicationShell, HomeRoute } from "./routes";

export const routes: RouteObject[] = [
  { path: "/", element: <ApplicationShell />, children: [{ index: true, element: <HomeRoute /> }] },
];
