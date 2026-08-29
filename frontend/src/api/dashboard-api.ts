import { generatedApi } from "@/api/generated/api";

export const dashboardApi = generatedApi.enhanceEndpoints({
  endpoints: {
    list: { providesTags: ["Sessions"] },
    detail: { providesTags: ["Sessions"] },
    setPhase: { invalidatesTags: ["Sessions", "IssueUsage", "UsageTimeline"] },
    relink: { invalidatesTags: ["Sessions", "IssueUsage", "LinearStatus"] },
    status: { providesTags: ["LinearStatus"] },
    sync: { invalidatesTags: ["LinearStatus", "Sessions"] },
    listIssueUsage: { providesTags: ["IssueUsage"] },
    getIssueUsage: { providesTags: ["IssueUsage"] },
    importStatus: { providesTags: ["ImportStatus"] },
    rescan: { invalidatesTags: ["ImportStatus", "Sessions", "IssueUsage", "UsageTimeline"] },
    costCalculationStatus: { providesTags: ["CostStatus"] },
    recalculateCosts: { invalidatesTags: ["CostStatus", "IssueUsage", "UsageTimeline"] },
    timeline: { providesTags: ["UsageTimeline"] },
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
  useTimelineQuery: useUsageTimelineQuery,
} = dashboardApi;
