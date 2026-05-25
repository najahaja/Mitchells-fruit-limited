import type {
  CallRecord,
  CreateCategoryPayload,
  CreateItemPayload,
  CreatePromptPayload,
  UpdatePromptPayload,
  DashboardStats,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  MessageResponse,
  MenuCategory,
  MenuItem,
  MenuPreview,
  Prompt,
  ReportData,
  Settings,
  Special,
  SpecialPayload,
  UpdateCategoryPayload,
  UpdateItemPayload,
  UpdateSettingsPayload,
  VoicesResponse,
  Agent,
  CreateAgentPayload,
} from "../type";
import axiosInstance from "./interceptor";

// 🔐 LOGIN — uses x-www-form-urlencoded as required by the API
export const loginApi = async (data: LoginPayload): Promise<LoginResponse> => {
  const params = new URLSearchParams();
  params.append("username", data.email);
  params.append("password", data.password);

  const response = await axiosInstance.post<LoginResponse>(
    "/auth/login",
    params,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  return response.data;
};

// 🔐 REGISTER
export const registerApi = async (data: RegisterPayload): Promise<RegisterResponse> => {
  const response = await axiosInstance.post<RegisterResponse>("/auth/register", data);
  return response.data;
};

// 🔐 FORGOT PASSWORD
export const forgotPasswordApi = async (data: ForgotPasswordPayload): Promise<MessageResponse> => {
  const response = await axiosInstance.post<MessageResponse>("/auth/forgot-password", data);
  return response.data;
};

// 🔐 RESET PASSWORD
export const resetPasswordApi = async (data: ResetPasswordPayload): Promise<MessageResponse> => {
  const response = await axiosInstance.post<MessageResponse>("/auth/reset-password", data);
  return response.data;
};

export const getCategoriesApi = async (): Promise<MenuCategory[]> => {
  const res = await axiosInstance.get("/menu/categories");
  return res.data;
};

export const createCategoryApi = async (
  data: CreateCategoryPayload,
): Promise<MenuCategory> => {
  const res = await axiosInstance.post("/menu/categories", data);
  return res.data;
};

export const updateCategoryApi = async (
  id: string,
  data: UpdateCategoryPayload,
): Promise<MenuCategory> => {
  const res = await axiosInstance.patch(`/menu/categories/${id}`, data);
  return res.data;
};

export const deleteCategoryApi = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/menu/categories/${id}`);
};

// ── Item APIs ──
export const getItemsByCategoryApi = async (
  categoryId: string,
): Promise<MenuItem[]> => {
  const res = await axiosInstance.get(`/menu/items?category_id=${categoryId}`);
  return res.data;
};

export const createItemApi = async (
  data: CreateItemPayload,
): Promise<MenuItem> => {
  const res = await axiosInstance.post("/menu/items", data);
  return res.data;
};

export const updateItemApi = async (
  id: string,
  d: UpdateItemPayload,
): Promise<MenuItem> =>
  (await axiosInstance.patch(`/menu/items/${id}`, d)).data;

export const deleteItemApi = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/menu/items/${id}`);
};

// ── Preview API ──
export const getMenuPreviewApi = async (): Promise<MenuPreview> =>
  (await axiosInstance.get("/menu/preview")).data;

// ── Specials APIs ──
export const getSpecialsApi = async (
  activeOnly?: boolean,
): Promise<Special[]> =>
  (
    await axiosInstance.get(
      `/menu/specials${activeOnly !== undefined ? `?active_only=${activeOnly}` : ""}`,
    )
  ).data;
export const createSpecialApi = async (d: SpecialPayload): Promise<Special> =>
  (await axiosInstance.post("/menu/specials", d)).data;
export const updateSpecialApi = async (
  id: string,
  d: Partial<SpecialPayload>,
): Promise<Special> =>
  (await axiosInstance.patch(`/menu/specials/${id}`, d)).data;
export const deleteSpecialApi = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/menu/specials/${id}`);
};

// 📞 GET CALLS
export const getCallsApi = async (
  skip = 0,
  limit = 20,
): Promise<CallRecord[]> => {
  const response = await axiosInstance.get(
    `/retell/calls?skip=${skip}&limit=${limit}`,
  );
  return response.data;
};

// 🛒 CONFIRM CALL ORDER
export const confirmCallOrderApi = async (
  callId: string,
  data: {
    customer_name: string;
    customer_phone: string;
    order_items: { item: string; quantity: number; price?: number }[];
    order_type: string;
    delivery_address?: string;
    total_amount?: number;
  },
): Promise<any> => {
  const res = await axiosInstance.post(`/retell/calls/${callId}/order`, data);
  return res.data;
};

// 🖨️ FORCE REPRINT ORDER to Clover POS
export const reprintOrderApi = async (orderId: string): Promise<any> => {
  const res = await axiosInstance.post(`/retell/orders/${orderId}/reprint`);
  return res.data;
};

// ❌ CANCEL ORDER
export const cancelOrderApi = async (orderId: string): Promise<any> => {
  const res = await axiosInstance.patch(`/retell/orders/${orderId}`, { status: "cancelled" });
  return res.data;
};

// 📋 GET SETTINGS
export const getSettingsApi = async (): Promise<Settings> => {
  const res = await axiosInstance.get("/settings");
  return res.data;
};

// ✏️ UPDATE SETTINGS
export const updateSettingsApi = async (
  data: UpdateSettingsPayload,
): Promise<Settings> => {
  const res = await axiosInstance.patch("/settings", data);
  return res.data;
};

// 🎙️ GET VOICES
export const getVoicesApi = async (): Promise<VoicesResponse> => {
  const res = await axiosInstance.get("/settings/voices");
  return res.data;
};

//overview page api
export const getDashboardStatsApi = async (): Promise<DashboardStats> => {
  const res = await axiosInstance.get("/retell/stats");
  return res.data;
};

export const getReportApi = async (days = 7): Promise<ReportData> => {
  const res = await axiosInstance.get(`/retell/reports?days=${days}`);
  return res.data;
};

// ── Prompts APIs ──
export const getPromptsApi = async (): Promise<Prompt[]> => {
  const res = await axiosInstance.get("/prompts");
  return res.data;
};

export const createPromptApi = async (
  data: CreatePromptPayload,
): Promise<Prompt> => {
  const res = await axiosInstance.post("/prompts", data);
  return res.data;
};

export const updatePromptApi = async (
  id: string,
  data: UpdatePromptPayload,
): Promise<Prompt> => {
  const res = await axiosInstance.patch(`/prompts/${id}`, data);
  return res.data;
};

export const activatePromptApi = async (id: string): Promise<Prompt> => {
  const res = await axiosInstance.patch(`/prompts/${id}/activate`);
  return res.data;
};

export const deactivatePromptApi = async (id: string): Promise<Prompt> => {
  const res = await axiosInstance.patch(`/prompts/${id}/deactivate`);
  return res.data;
};

export const deletePromptApi = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/prompts/${id}`);
};

export const getAgentsApi = async (): Promise<Agent[]> => {
  const res = await axiosInstance.get("/settings/agents");
  return res.data;
};

export const createAgentApi = async (data: CreateAgentPayload): Promise<Agent> => {
  const res = await axiosInstance.post("/settings/agents", data);
  return res.data;
};