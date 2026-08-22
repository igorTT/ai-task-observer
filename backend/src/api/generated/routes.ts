/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SystemController } from './../controllers/system.controller.js';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SessionsController } from './../controllers/sessions.controller.js';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { LinearController } from './../controllers/linear.controller.js';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { IssueUsageController } from './../controllers/issue-usage.controller.js';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ImportsController } from './../controllers/imports.controller.js';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { CostsController } from './../controllers/costs.controller.js';
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';



// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "HealthResponse": {
        "dataType": "refObject",
        "properties": {
            "status": {"dataType":"enum","enums":["healthy"],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TokenCompletenessResponse": {
        "dataType": "refObject",
        "properties": {
            "input": {"dataType":"boolean","required":true},
            "cachedInput": {"dataType":"boolean","required":true},
            "uncachedInput": {"dataType":"boolean","required":true},
            "output": {"dataType":"boolean","required":true},
            "total": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AttributionStatus": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["unlinked"]},{"dataType":"enum","enums":["unconfigured"]},{"dataType":"enum","enums":["pending"]},{"dataType":"enum","enums":["linked"]},{"dataType":"enum","enums":["not_found"]},{"dataType":"enum","enums":["error"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LinearIssueResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "identifier": {"dataType":"string","required":true},
            "title": {"dataType":"string","required":true},
            "url": {"dataType":"string","required":true},
            "team": {"dataType":"nestedObjectLiteral","nestedProperties":{"name":{"dataType":"string","required":true},"key":{"dataType":"string","required":true},"id":{"dataType":"string","required":true}},"required":true},
            "state": {"dataType":"nestedObjectLiteral","nestedProperties":{"name":{"dataType":"string","required":true},"id":{"dataType":"string","required":true}},"required":true},
            "updatedAt": {"dataType":"string","required":true},
            "synchronizedAt": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LinearFailureCategory": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["authentication"]},{"dataType":"enum","enums":["rate_limit"]},{"dataType":"enum","enums":["network"]},{"dataType":"enum","enums":["timeout"]},{"dataType":"enum","enums":["upstream"]},{"dataType":"enum","enums":["identifier_mismatch"]},{"dataType":"enum","enums":["unknown"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SessionAttributionResponse": {
        "dataType": "refObject",
        "properties": {
            "status": {"ref":"AttributionStatus","required":true},
            "candidateIdentifier": {"dataType":"string"},
            "phase": {"dataType":"string"},
            "issue": {"ref":"LinearIssueResponse"},
            "relinkRequired": {"dataType":"boolean","required":true},
            "lastAttemptAt": {"dataType":"string"},
            "lastSuccessAt": {"dataType":"string"},
            "synchronizationState": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["unlinked"]},{"dataType":"enum","enums":["unconfigured"]},{"dataType":"enum","enums":["pending"]},{"dataType":"enum","enums":["synchronized"]},{"dataType":"enum","enums":["not_found"]},{"dataType":"enum","enums":["error"]}],"required":true},
            "failureCategory": {"ref":"LinearFailureCategory"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SessionResponse": {
        "dataType": "refObject",
        "properties": {
            "sessionId": {"dataType":"string","required":true},
            "currentTitle": {"dataType":"string"},
            "startedAt": {"dataType":"string"},
            "endedAt": {"dataType":"string"},
            "developerTurns": {"dataType":"string","required":true},
            "inputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "cachedInputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "uncachedInputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "outputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "totalTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "usageObserved": {"dataType":"boolean","required":true},
            "tokenCompleteness": {"ref":"TokenCompletenessResponse","required":true},
            "usageAnomalies": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "importState": {"dataType":"string","required":true},
            "attribution": {"ref":"SessionAttributionResponse","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SessionPageResponse": {
        "dataType": "refObject",
        "properties": {
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"SessionResponse"},"required":true},
            "total": {"dataType":"double","required":true},
            "limit": {"dataType":"double","required":true},
            "offset": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "error": {"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true},"code":{"dataType":"string","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SessionRelinkResponse": {
        "dataType": "refObject",
        "properties": {
            "attribution": {"ref":"SessionAttributionResponse","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SessionRelinkErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "error": {"dataType":"nestedObjectLiteral","nestedProperties":{"failureCategory":{"ref":"LinearFailureCategory"},"message":{"dataType":"string","required":true},"code":{"dataType":"string","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SessionRelinkRequest": {
        "dataType": "refObject",
        "properties": {
            "issueIdentifier": {"dataType":"string","required":true,"validators":{"pattern":{"value":"^[A-Za-z][A-Za-z0-9]*-[1-9][0-9]*$"}}},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_AttributionStatus.number_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{"unlinked":{"dataType":"double","required":true},"unconfigured":{"dataType":"double","required":true},"pending":{"dataType":"double","required":true},"linked":{"dataType":"double","required":true},"not_found":{"dataType":"double","required":true},"error":{"dataType":"double","required":true}},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LinearSyncRunResponse": {
        "dataType": "refObject",
        "properties": {
            "runId": {"dataType":"string","required":true},
            "trigger": {"dataType":"string","required":true},
            "state": {"dataType":"string","required":true},
            "candidateCount": {"dataType":"double","required":true},
            "linkedCount": {"dataType":"double","required":true},
            "notFoundCount": {"dataType":"double","required":true},
            "errorCount": {"dataType":"double","required":true},
            "failureCategory": {"ref":"LinearFailureCategory"},
            "startedAt": {"dataType":"string"},
            "completedAt": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LinearStatusResponse": {
        "dataType": "refObject",
        "properties": {
            "configured": {"dataType":"boolean","required":true},
            "state": {"dataType":"string","required":true},
            "acceptingWork": {"dataType":"boolean","required":true},
            "counts": {"ref":"Record_AttributionStatus.number_","required":true},
            "currentRun": {"ref":"LinearSyncRunResponse"},
            "lastCompletedRun": {"ref":"LinearSyncRunResponse"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LinearSyncResponse": {
        "dataType": "refObject",
        "properties": {
            "runId": {"dataType":"string","required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["queued"]},{"dataType":"enum","enums":["running"]}],"required":true},
            "coalesced": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageIdentityResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "identifier": {"dataType":"string","required":true},
            "title": {"dataType":"string","required":true},
            "url": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UsageMetricsResponse": {
        "dataType": "refObject",
        "properties": {
            "sessionCount": {"dataType":"string","required":true},
            "developerTurns": {"dataType":"string","required":true},
            "inputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "cachedInputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "outputTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "totalTokens": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "estimatedCostUsd": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "tokenComplete": {"dataType":"boolean","required":true},
            "costComplete": {"dataType":"boolean","required":true},
            "anomalyCodes": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "pricingGapCodes": {"dataType":"array","array":{"dataType":"string"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageSummaryResponse": {
        "dataType": "refObject",
        "properties": {
            "issue": {"ref":"IssueUsageIdentityResponse","required":true},
            "metrics": {"ref":"UsageMetricsResponse","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageListResponse": {
        "dataType": "refObject",
        "properties": {
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"IssueUsageSummaryResponse"},"required":true},
            "total": {"dataType":"string","required":true},
            "limit": {"dataType":"double","required":true},
            "offset": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CostGenerationIdentityResponse": {
        "dataType": "refObject",
        "properties": {
            "generationId": {"dataType":"string","required":true},
            "sourceFactRevision": {"dataType":"string","required":true},
            "pricingCatalogVersion": {"dataType":"string","required":true},
            "pricingContentHash": {"dataType":"string","required":true},
            "calculatorVersion": {"dataType":"string","required":true},
            "completedAt": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageModelResponse": {
        "dataType": "refObject",
        "properties": {
            "model": {"dataType":"string","required":true},
            "observedModels": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "metrics": {"ref":"UsageMetricsResponse","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageSessionResponse": {
        "dataType": "refObject",
        "properties": {
            "sessionId": {"dataType":"string","required":true},
            "title": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "phase": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "importState": {"dataType":"string","required":true},
            "lastError": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "startedAt": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "endedAt": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "metrics": {"ref":"UsageMetricsResponse","required":true},
            "models": {"dataType":"array","array":{"dataType":"refObject","ref":"IssueUsageModelResponse"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageDailyResponse": {
        "dataType": "refObject",
        "properties": {
            "date": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "metrics": {"ref":"UsageMetricsResponse","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IssueUsageDetailResponse": {
        "dataType": "refObject",
        "properties": {
            "issue": {"ref":"IssueUsageIdentityResponse","required":true},
            "metrics": {"ref":"UsageMetricsResponse","required":true},
            "latestCompletedCostGeneration": {"dataType":"union","subSchemas":[{"ref":"CostGenerationIdentityResponse"},{"dataType":"enum","enums":[null]}],"required":true},
            "sessions": {"dataType":"array","array":{"dataType":"refObject","ref":"IssueUsageSessionResponse"},"required":true},
            "models": {"dataType":"array","array":{"dataType":"refObject","ref":"IssueUsageModelResponse"},"required":true},
            "daily": {"dataType":"array","array":{"dataType":"refObject","ref":"IssueUsageDailyResponse"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RootStatusResponse": {
        "dataType": "refObject",
        "properties": {
            "root": {"dataType":"string","required":true},
            "available": {"dataType":"boolean","required":true},
            "reason": {"dataType":"string"},
            "discoveredFiles": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ImportRunResponse": {
        "dataType": "refObject",
        "properties": {
            "runId": {"dataType":"string","required":true},
            "trigger": {"dataType":"string","required":true},
            "state": {"dataType":"string","required":true},
            "startedAt": {"dataType":"string"},
            "completedAt": {"dataType":"string"},
            "rootsDiscovered": {"dataType":"double","required":true},
            "filesDiscovered": {"dataType":"double","required":true},
            "filesImported": {"dataType":"double","required":true},
            "sessionsImported": {"dataType":"double","required":true},
            "warnings": {"dataType":"double","required":true},
            "errors": {"dataType":"double","required":true},
            "summary": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CheckpointStatusResponse": {
        "dataType": "refObject",
        "properties": {
            "source": {"dataType":"string","required":true},
            "status": {"dataType":"string","required":true},
            "completeOffset": {"dataType":"string","required":true},
            "unknownRecords": {"dataType":"double","required":true},
            "malformedRecords": {"dataType":"double","required":true},
            "lastError": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ImportStatusResponse": {
        "dataType": "refObject",
        "properties": {
            "roots": {"dataType":"array","array":{"dataType":"refObject","ref":"RootStatusResponse"},"required":true},
            "currentRun": {"ref":"ImportRunResponse"},
            "lastCompletedRun": {"ref":"ImportRunResponse"},
            "checkpoints": {"dataType":"array","array":{"dataType":"refObject","ref":"CheckpointStatusResponse"},"required":true},
            "acceptingWork": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RescanResponse": {
        "dataType": "refObject",
        "properties": {
            "runId": {"dataType":"string","required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["queued"]},{"dataType":"enum","enums":["running"]}],"required":true},
            "coalesced": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CostGenerationResponse": {
        "dataType": "refObject",
        "properties": {
            "generationId": {"dataType":"string","required":true},
            "sourceFactRevision": {"dataType":"string","required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["running"]},{"dataType":"enum","enums":["completed"]},{"dataType":"enum","enums":["failed"]}],"required":true},
            "pricingSchemaVersion": {"dataType":"double","required":true},
            "pricingCatalogVersion": {"dataType":"string","required":true},
            "pricingContentHash": {"dataType":"string","required":true},
            "calculatorVersion": {"dataType":"string","required":true},
            "tokenUnit": {"dataType":"string","required":true},
            "startedAt": {"dataType":"string","required":true},
            "completedAt": {"dataType":"string"},
            "failureCategory": {"dataType":"enum","enums":["calculation_failed"]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CostWorkResponse": {
        "dataType": "refObject",
        "properties": {
            "generationId": {"dataType":"string","required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["running"]},{"dataType":"enum","enums":["queued"]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CostConfigurationResponse": {
        "dataType": "refObject",
        "properties": {
            "schemaVersion": {"dataType":"double","required":true},
            "catalogVersion": {"dataType":"string","required":true},
            "contentHash": {"dataType":"string","required":true},
            "currency": {"dataType":"enum","enums":["USD"],"required":true},
            "tokenUnit": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CostCalculationStatusResponse": {
        "dataType": "refObject",
        "properties": {
            "estimateKind": {"dataType":"enum","enums":["configured_api_equivalent_usd"],"required":true},
            "latestCompleted": {"ref":"CostGenerationResponse"},
            "active": {"ref":"CostWorkResponse"},
            "queued": {"ref":"CostWorkResponse"},
            "latestFailure": {"ref":"CostGenerationResponse"},
            "currentFactRevision": {"dataType":"string","required":true},
            "coverage": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["current"]},{"dataType":"enum","enums":["stale"]},{"dataType":"enum","enums":["missing"]}],"required":true},
            "config": {"ref":"CostConfigurationResponse","required":true},
            "calculatorVersion": {"dataType":"string","required":true},
            "acceptingWork": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RecalculateCostResponse": {
        "dataType": "refObject",
        "properties": {
            "generationId": {"dataType":"string","required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["running"]},{"dataType":"enum","enums":["queued"]}],"required":true},
            "coalesced": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


    
        const argsSystemController_getHealth: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/health',
            ...(fetchMiddlewares<RequestHandler>(SystemController)),
            ...(fetchMiddlewares<RequestHandler>(SystemController.prototype.getHealth)),

            async function SystemController_getHealth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSystemController_getHealth, request, response });

                const controller = new SystemController();

              await templateService.apiHandler({
                methodName: 'getHealth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSessionsController_list: Record<string, TsoaRoute.ParameterSchema> = {
                limit: {"default":50,"in":"query","name":"limit","dataType":"double"},
                offset: {"default":0,"in":"query","name":"offset","dataType":"double"},
        };
        app.get('/api/sessions',
            ...(fetchMiddlewares<RequestHandler>(SessionsController)),
            ...(fetchMiddlewares<RequestHandler>(SessionsController.prototype.list)),

            async function SessionsController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSessionsController_list, request, response });

                const controller = new SessionsController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSessionsController_detail: Record<string, TsoaRoute.ParameterSchema> = {
                sessionId: {"in":"path","name":"sessionId","required":true,"dataType":"string"},
        };
        app.get('/api/sessions/:sessionId',
            ...(fetchMiddlewares<RequestHandler>(SessionsController)),
            ...(fetchMiddlewares<RequestHandler>(SessionsController.prototype.detail)),

            async function SessionsController_detail(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSessionsController_detail, request, response });

                const controller = new SessionsController();

              await templateService.apiHandler({
                methodName: 'detail',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSessionsController_relink: Record<string, TsoaRoute.ParameterSchema> = {
                sessionId: {"in":"path","name":"sessionId","required":true,"dataType":"string"},
                request: {"in":"body","name":"request","required":true,"ref":"SessionRelinkRequest"},
        };
        app.post('/api/sessions/:sessionId/relink',
            ...(fetchMiddlewares<RequestHandler>(SessionsController)),
            ...(fetchMiddlewares<RequestHandler>(SessionsController.prototype.relink)),

            async function SessionsController_relink(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSessionsController_relink, request, response });

                const controller = new SessionsController();

              await templateService.apiHandler({
                methodName: 'relink',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsLinearController_status: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/linear/status',
            ...(fetchMiddlewares<RequestHandler>(LinearController)),
            ...(fetchMiddlewares<RequestHandler>(LinearController.prototype.status)),

            async function LinearController_status(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsLinearController_status, request, response });

                const controller = new LinearController();

              await templateService.apiHandler({
                methodName: 'status',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsLinearController_sync: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.post('/api/linear/sync',
            ...(fetchMiddlewares<RequestHandler>(LinearController)),
            ...(fetchMiddlewares<RequestHandler>(LinearController.prototype.sync)),

            async function LinearController_sync(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsLinearController_sync, request, response });

                const controller = new LinearController();

              await templateService.apiHandler({
                methodName: 'sync',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 202,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIssueUsageController_listIssueUsage: Record<string, TsoaRoute.ParameterSchema> = {
                limit: {"default":50,"in":"query","name":"limit","dataType":"double"},
                offset: {"default":0,"in":"query","name":"offset","dataType":"double"},
        };
        app.get('/api/issues/usage',
            ...(fetchMiddlewares<RequestHandler>(IssueUsageController)),
            ...(fetchMiddlewares<RequestHandler>(IssueUsageController.prototype.listIssueUsage)),

            async function IssueUsageController_listIssueUsage(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIssueUsageController_listIssueUsage, request, response });

                const controller = new IssueUsageController();

              await templateService.apiHandler({
                methodName: 'listIssueUsage',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIssueUsageController_getIssueUsage: Record<string, TsoaRoute.ParameterSchema> = {
                issueId: {"in":"path","name":"issueId","required":true,"dataType":"string"},
        };
        app.get('/api/issues/:issueId/usage',
            ...(fetchMiddlewares<RequestHandler>(IssueUsageController)),
            ...(fetchMiddlewares<RequestHandler>(IssueUsageController.prototype.getIssueUsage)),

            async function IssueUsageController_getIssueUsage(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIssueUsageController_getIssueUsage, request, response });

                const controller = new IssueUsageController();

              await templateService.apiHandler({
                methodName: 'getIssueUsage',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsImportsController_importStatus: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/imports/status',
            ...(fetchMiddlewares<RequestHandler>(ImportsController)),
            ...(fetchMiddlewares<RequestHandler>(ImportsController.prototype.importStatus)),

            async function ImportsController_importStatus(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsImportsController_importStatus, request, response });

                const controller = new ImportsController();

              await templateService.apiHandler({
                methodName: 'importStatus',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsImportsController_rescan: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.post('/api/imports/rescan',
            ...(fetchMiddlewares<RequestHandler>(ImportsController)),
            ...(fetchMiddlewares<RequestHandler>(ImportsController.prototype.rescan)),

            async function ImportsController_rescan(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsImportsController_rescan, request, response });

                const controller = new ImportsController();

              await templateService.apiHandler({
                methodName: 'rescan',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 202,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCostsController_costCalculationStatus: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/costs/status',
            ...(fetchMiddlewares<RequestHandler>(CostsController)),
            ...(fetchMiddlewares<RequestHandler>(CostsController.prototype.costCalculationStatus)),

            async function CostsController_costCalculationStatus(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCostsController_costCalculationStatus, request, response });

                const controller = new CostsController();

              await templateService.apiHandler({
                methodName: 'costCalculationStatus',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCostsController_recalculateCosts: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.post('/api/costs/recalculate',
            ...(fetchMiddlewares<RequestHandler>(CostsController)),
            ...(fetchMiddlewares<RequestHandler>(CostsController.prototype.recalculateCosts)),

            async function CostsController_recalculateCosts(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCostsController_recalculateCosts, request, response });

                const controller = new CostsController();

              await templateService.apiHandler({
                methodName: 'recalculateCosts',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 202,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
