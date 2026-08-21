import { baseApi } from "@/redux/baseApi";

export type AssistantTurn = { role: "user" | "model"; text: string };

export type AssistantChatRequest = {
  message: string;
  history?: AssistantTurn[];
};

export type AssistantUsage = {
  used: number;
  limit: number;
  remaining: number;
};

export type AssistantChatResponse = {
  answer: string;
  model: string;
  usage?: AssistantUsage;
};

export type AssistantStatus = {
  configured: boolean;
  model: string | null;
  usage?: AssistantUsage;
};

export const assistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAssistantStatus: builder.query<AssistantStatus, void>({
      query: () => ({ url: "/assistant/status", method: "GET" }),
    }),
    chatWithAssistant: builder.mutation<AssistantChatResponse, AssistantChatRequest>({
      query: (body) => ({ url: "/assistant/chat", method: "POST", data: body }),
    }),
  }),
});

export const { useGetAssistantStatusQuery, useChatWithAssistantMutation } = assistantApi;
