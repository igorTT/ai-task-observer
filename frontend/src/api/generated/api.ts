import { baseApi as api } from "../base-api";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
      query: () => ({ url: `/api/health` }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedApi };
export type GetHealthApiResponse = /** status 200 Healthy */ HealthResponse;
export type GetHealthApiArg = void;
export type HealthResponse = {
  status: "healthy";
};
export const { useGetHealthQuery } = injectedRtkApi;
