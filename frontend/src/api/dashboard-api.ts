import { generatedApi } from "@/api/generated/api";

export const dashboardApi = generatedApi.enhanceEndpoints({
  endpoints: {
    list: { providesTags: ["Sessions"] },
    detail: { providesTags: ["Sessions"] },
    relink: { invalidatesTags: ["Sessions", "IssueUsage", "LinearStatus"] },
    status: { providesTags: ["LinearStatus"] },
    sync: { invalidatesTags: ["LinearStatus", "Sessions"] },
    listIssueUsage: { providesTags: ["IssueUsage"] },
    getIssueUsage: { providesTags: ["IssueUsage"] },
    importStatus: { providesTags: ["ImportStatus"] },
    rescan: { invalidatesTags: ["ImportStatus", "Sessions", "IssueUsage"] },
    costCalculationStatus: { providesTags: ["CostStatus"] },
    recalculateCosts: { invalidatesTags: ["CostStatus", "IssueUsage"] },
  },
});

export const {
  useListQuery: useSessionsQuery,
  useRelinkMutation,
  useStatusQuery: useLinearStatusQuery,
  useSyncMutation: useLinearSyncMutation,
  useListIssueUsageQuery,
  useGetIssueUsageQuery,
  useImportStatusQuery,
  useRescanMutation,
  useCostCalculationStatusQuery,
  useRecalculateCostsMutation,
} = dashboardApi;
