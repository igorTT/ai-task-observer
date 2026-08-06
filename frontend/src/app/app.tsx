import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider, type RouterProviderProps } from "react-router-dom";

import { createAppStore, type AppStore } from "./store";
import { routes } from "./route-config";

export interface AppProps {
  readonly router?: RouterProviderProps["router"];
  readonly store?: AppStore;
}

export function App({ router = createBrowserRouter(routes), store = createAppStore() }: AppProps) {
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  );
}
