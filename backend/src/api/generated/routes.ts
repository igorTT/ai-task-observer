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
import { ImportsController } from './../controllers/imports.controller.js';
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
    "SessionResponse": {
        "dataType": "refObject",
        "properties": {
            "sessionId": {"dataType":"string","required":true},
            "currentTitle": {"dataType":"string"},
            "startedAt": {"dataType":"string"},
            "endedAt": {"dataType":"string"},
            "developerTurns": {"dataType":"string","required":true},
            "inputTokens": {"dataType":"string","required":true},
            "cachedInputTokens": {"dataType":"string","required":true},
            "outputTokens": {"dataType":"string","required":true},
            "totalTokens": {"dataType":"string","required":true},
            "usageObserved": {"dataType":"boolean","required":true},
            "importState": {"dataType":"string","required":true},
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

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
