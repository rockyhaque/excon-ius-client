import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./baseApi";
import { setupListeners } from "@reduxjs/toolkit/query";
import authReducer from "@/redux/features/auth/auth.slice";
import { setAccessToken } from "@/lib/authToken";

// Register RTK Query endpoints (injectEndpoints side effects)
import "@/redux/features/auth/auth.api";
import "@/redux/features/users/users.api";
import "@/redux/features/foundations/foundations.api";
import "@/redux/features/exam-room/examRoom.api";
import "@/redux/features/leaves/leaves.api";
import "@/redux/features/allocations/allocations.api";
import "@/redux/features/logs/logs.api";
import "@/redux/features/assistant/assistant.api";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

setupListeners(store.dispatch);

// Keep axios token access out of Redux import graph (prevents circular deps).
store.subscribe(() => {
  setAccessToken(store.getState().auth.accessToken);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

