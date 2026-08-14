import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "STAFF";
  createdAt?: string;
}

export interface Event {
  id: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  layoutImageUrl?: string | null;
}

export interface Category {
  id: string;
  eventId: string;
  code: string;
  label: string;
  size?: string | null;
  price: string | number;
  colorHex?: string | null;
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

export interface Booking {
  id: string;
  eventId: string;
  exhibitorName: string;
  company?: string | null;
  phone: string;
  email?: string | null;
  gst?: string | null;
  totalAmount: string | number;
  amountPaid: string | number;
  paymentStatus: PaymentStatus;
  bookedByOrg: BookedByOrg;
  notes?: string | null;
  createdAt: string;
  stalls: { stall: Stall }[];
  payments: Payment[];
}

export interface Hold {
  id: string;
  eventId: string;
  exhibitorName?: string | null;
  phone?: string | null;
  notes?: string | null;
  bookedByOrg: BookedByOrg;
  releaseAt?: string | null;
  createdAt: string;
  stalls: { stall: Stall }[];
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
