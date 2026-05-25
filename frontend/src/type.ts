// ── Types ──
export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_admin: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  allergens: string | null;
  prep_time_minutes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_available: boolean;
  created_at: string;
  items: MenuItem[];
}

export interface CreateCategoryPayload {
  name: string;
  description: string;
  sort_order: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  sort_order?: number;
  is_available?: boolean;
}

export interface CreateItemPayload {
  category_id: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  allergens: string;
  prep_time_minutes: number;
  sort_order: number;
}

export interface MenuPreview {
  menu_text: string;
  category_count: number;
  item_count: number;
  active_specials_count: number;
  unavailable_items_count: number;
}

export interface Special {
  id: string;
  title: string;
  description: string;
  discount_type: string;
  discount_value: number;
  applicable_items: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpecialPayload {
  title: string;
  description: string;
  discount_type: string;
  discount_value: number;
  applicable_items: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export interface UpdateItemPayload {
  name?: string;
  description?: string;
  price?: number;
  is_available?: boolean;
  allergens?: string;
  prep_time_minutes?: number;
  sort_order?: number;
  category_id?: string;
}

export interface CallRecord {
  id: string;
  call_id: string;
  caller_phone: string;
  customer_name: string | null;
  call_status: string;
  direction: string;
  recording_url: string | null;
  transcript: string | null;
  call_summary: string | null;
  order_booked: boolean;
  call_successful: boolean | null;
  user_sentiment: string | null;
  duration_ms: number;
  start_timestamp: number;
  end_timestamp: number;
  order_items: any | null;
  order_type: string | null;
  special_notes: string | null;
  call_reason: string | null;
  customer_name_extracted: string | null;
  reservation_date: string | null;
  party_size: number | null;
  created_at: string;
  order_details: any | null;
}

// ── Settings Types ──
export type DaySchedule = { open: string; close: string; closed: boolean };
export type WeeklySchedule = Record<string, DaySchedule>;

export interface Settings {
  id: string;
  voice_id: string;
  voice_speed: number;
  voice_temperature: number;
  interruption_sensitivity: number;
  responsiveness: number;
  is_active: boolean;
  kitchen_open_time: string;
  kitchen_close_time: string;
  store_open_time: string;
  store_close_time: string;
  closed_greeting: string;
  open_greeting: string | null;
  restaurant_timezone: string;
  force_store_open: boolean | null;
  prompt_instructions: string | null;
  locked_prompt_tail: string | null;
  delivery_address: string | null;
  pickup_address: string | null;
  restaurant_name: string | null;
  restaurant_info: string | null;
  wait_time_pickup: string | null;
  wait_time_delivery: string | null;
  store_hours: WeeklySchedule | null;
  kitchen_hours: WeeklySchedule | null;
  retell_live: any | null;
  updated_at: string;
}

export interface UpdateSettingsPayload {
  voice_id?: string;
  voice_speed?: number;
  voice_temperature?: number;
  interruption_sensitivity?: number;
  responsiveness?: number;
  is_active?: boolean;
  kitchen_open_time?: string;
  kitchen_close_time?: string;
  store_open_time?: string;
  store_close_time?: string;
  closed_greeting?: string;
  open_greeting?: string;
  restaurant_timezone?: string;
  prompt_instructions?: string;
  delivery_address?: string;
  pickup_address?: string;
  restaurant_name?: string;
  restaurant_info?: string;
  wait_time_pickup?: string;
  wait_time_delivery?: string;
  store_hours?: WeeklySchedule | null;
  kitchen_hours?: WeeklySchedule | null;
}

export interface Prompt {
  id: string;
  name: string;
  version: number;
  description: string;
  text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface CreatePromptPayload {
  name: string;
  text: string;
}

export interface UpdatePromptPayload {
  name?: string;
  text?: string;
}

export interface Voice {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender: string;
  accent: string;
  age: string;
  preview_audio_url: string;
}

export interface VoicesResponse {
  voices: Voice[];
  current_voice_id: string;
  current_provider: string;
}

export interface DashboardStats {
  calls: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
  orders: {
    total: number;
    received: number;
    preparing: number;
    ready: number;
    completed: number;
    cancelled: number;
    today: number;
  };
}

// ── Reports Types ──
export interface ReportData {
  period_days: number;
  summary: {
    total_calls: number;
    total_orders: number;
    total_minutes: number;
    successful_calls: number;
    repeat_callers: number;
    new_callers: number;
    order_type_distribution: {
      pickup: number;
      delivery: number;
    };
  };
  calls_over_time: { date: string; calls: number }[];
  orders_over_time: { date: string; orders: number }[];
  top_repeat_callers: { phone: string; name: string; call_count: number }[];
  sentiment_breakdown: Record<string, number>;
}

export interface Agent {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  response_engine?: {
    type: string;
    conversation_flow_id: string;
  };
}

export interface CreateAgentPayload {
  agent_name: string;
  voice_id: string;
}
