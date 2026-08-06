import { Router } from "express";

import { RegisterRoutes } from "@/api/generated/routes.js";

export function createApiRouter(): Router {
  const router = Router();
  RegisterRoutes(router);
  return router;
}
