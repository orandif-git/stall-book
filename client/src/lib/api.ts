import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/invalid token (session timeout, JWT expiry, server restart with a rotated
// secret, etc.) isn't caught anywhere else — every page here just fires its own api.get() on
// mount with no auth-specific error handling, so a 401 previously just left the page's data
// state stuck at "loading" forever: header renders (it only reads the stale AuthContext admin
// object), but every tab/panel that depends on real data never appears. This is the one place
// that sees every request, so it's the right place to catch it globally: clear the stale
// session and send the user back to login instead of a silent blank screen.
// The login POST itself is excluded — a wrong password is a normal 401 the login form already
// handles inline, not an expired-session case, and redirecting *from* the login page on a
// failed login attempt would stomp on that error before it ever renders.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === "/auth/login";
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// Separate instance for the public booking portal (/book/:eventSlug) — deliberately has no
// auth interceptor, so an admin's token in localStorage can never end up on an anonymous
// customer's request even if both are open in the same browser.
export const publicApi = axios.create({ baseURL: "/api/public" });

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "STAFF";
  bookedByOrg: BookedByOrg;
  createdAt?: string;
}

export interface Event {
  id: string;
  slug: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  layoutImageUrl?: string | null;
  showCompanyPublicly: boolean;
}

export interface Category {
  id: string;
  eventId: string;
  code: string;
  label: string;
  size?: string | null;
  price: string | number;
  colorHex?: string | null;
  activity: ActivityLogEntry[];
}

export type StallStatus = "AVAILABLE" | "BOOKED" | "BLOCKED";

export interface Stall {
  id: string;
  eventId: string;
  categoryId: string;
  code: string;
  zone?: string | null;
  gridRow: number;
  gridCol: number;
  rowSpan: number;
  colSpan: number;
  status: StallStatus;
  category: Category;
  bookingLinks?: { booking: Booking }[];
  holdLinks?: { hold: Hold }[];
}

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type PaymentMode = "CASH" | "CHEQUE" | "UPI" | "BANK_TRANSFER" | "OTHER";
export type BookedByOrg = "MEC" | "CHAMBER_OF_COMMERCE";

export interface Payment {
  id: string;
  bookingId: string;
  amount: string | number;
  mode: PaymentMode;
  reference?: string | null;
  paidAt: string;
  notes?: string | null;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  description: string;
  performedByName: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  eventId: string;
  exhibitorName: string;
  company?: string | null;
  phone: string;
  email?: string | null;
  gst?: string | null;
  address?: string | null;
  city?: string | null;
  productService?: string | null;
  reference?: string | null;
  totalAmount: string | number;
  amountPaid: string | number;
  paymentStatus: PaymentStatus;
  bookedByOrg: BookedByOrg;
  notes?: string | null;
  createdAt: string;
  stalls: { stall: Stall }[];
  payments: Payment[];
  activity: ActivityLogEntry[];
}

export type HoldSource = "ADMIN" | "PUBLIC_REQUEST";

export interface Hold {
  id: string;
  eventId: string;
  exhibitorName?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  productService?: string | null;
  notes?: string | null;
  bookedByOrg: BookedByOrg;
  source: HoldSource;
  otpVerifiedAt?: string | null;
  reference?: string | null;
  releaseAt?: string | null;
  createdAt: string;
  stalls: { stall: Stall }[];
  activity: ActivityLogEntry[];
}

export type FloorPlanStatus = "AVAILABLE" | "BLOCKED" | "BOOKED_UNPAID" | "BOOKED_PARTIAL" | "BOOKED_PAID";

export interface FloorPlanStall {
  id: string;
  code: string;
  categoryCode: string;
  categoryLabel: string;
  price: number;
  colorHex: string | null;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
  rotation: number;
  shape: "rect" | "poly";
  points: number[];
  status: FloorPlanStatus;
  bookingId?: string;
  exhibitorName?: string;
  company?: string | null;
  totalAmount?: number;
  amountPaid?: number;
  holdId?: string;
  blockedFor?: string | null;
  blockReason?: string | null;
}

export type DecorKind = "WALL" | "AISLE" | "STAIRS" | "LABEL" | "ARROW";

export interface FloorPlanDecorItem {
  id: string;
  kind: DecorKind;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
  text: string | null;
  points: number[];
}

export interface FloorPlanData {
  canvasWidth: number;
  canvasHeight: number;
  layoutImageUrl: string | null;
  stalls: FloorPlanStall[];
  decor: FloorPlanDecorItem[];
}

// --- Public booking portal ---

export interface PublicEvent {
  id: string;
  name: string;
  slug: string;
  venue: string;
  startDate: string;
  endDate: string;
  canvasWidth: number;
  canvasHeight: number;
  layoutImageUrl: string | null;
}

export type PublicStallStatus = "AVAILABLE" | "UNAVAILABLE";

export interface PublicFloorPlanStall {
  id: string;
  code: string;
  categoryLabel: string;
  price: number;
  colorHex: string | null;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
  rotation: number;
  shape: "rect" | "poly";
  points: number[];
  status: PublicStallStatus;
  company: string | null;
}

export interface PublicFloorPlanData {
  canvasWidth: number;
  canvasHeight: number;
  layoutImageUrl: string | null;
  stalls: PublicFloorPlanStall[];
  decor: FloorPlanDecorItem[];
}

export interface PublicConfig {
  turnstileSiteKey: string | null;
}

// --- WA Setup (Super Admin only) ---

export interface WhatsAppSettings {
  bspBaseUrl: string;
  bspApiKeySet: boolean;
  bspFromPhoneNumberId: string;
  otpLength: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  turnstileSiteKey: string;
  turnstileSecretKeySet: boolean;
  turnstileEnabled: boolean;
}

export interface FieldBinding {
  field: string;
  source: string;
}

export type MessagePurpose = "OTP";

export interface MessageTemplate {
  purpose: MessagePurpose;
  templateName: string;
  templateLanguage: string;
  fieldBindings: FieldBinding[];
}

export interface ReportSummary {
  stalls: { total: number; booked: number; blocked: number; available: number };
  revenue: { invoiced: number; collected: number; pending: number };
  bookingsCount: number;
  byCategory: {
    categoryId: string;
    code: string;
    label: string;
    price: number;
    total: number;
    booked: number;
    blocked: number;
    available: number;
    potentialRevenue: number;
    bookedRevenue: number;
  }[];
}
