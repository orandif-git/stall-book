import type { BookedByOrg, PaymentMode, PaymentStatus, StallStatus } from "./api";

// Display labels only — the underlying AdminRole enum value stays STAFF in the database.
export const ROLE_LABEL: Record<"SUPER_ADMIN" | "STAFF", string> = {
  SUPER_ADMIN: "Super Admin",
  STAFF: "Admin",
};

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_REFERENCE_LABEL: Partial<Record<PaymentMode, string>> = {
  CHEQUE: "Cheque number",
  UPI: "UPI transaction ID",
  BANK_TRANSFER: "Transaction reference",
  OTHER: "Reference",
};

export const ORG_LABEL: Record<BookedByOrg, string> = {
  MEC: "MEC",
  CHAMBER_OF_COMMERCE: "Chamber of Commerce",
};

export const ORG_LABEL_SHORT: Record<BookedByOrg, string> = {
  MEC: "MEC",
  CHAMBER_OF_COMMERCE: "Chamber",
};

export const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  PAID: "border-success/30 bg-success/10 text-success",
  PARTIAL: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
  UNPAID: "border-border bg-muted text-muted-foreground",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
};

export const STALL_STATUS_STYLES: Record<StallStatus, string> = {
  AVAILABLE: "bg-card border-border hover:border-primary/50",
  BOOKED: "bg-destructive/10 border-destructive/30 text-destructive",
  BLOCKED: "bg-muted border-border text-muted-foreground",
};
