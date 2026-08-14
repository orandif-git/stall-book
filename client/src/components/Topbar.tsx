import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, ChevronRight, LogOut, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Topbar({ crumb }: { crumb?: ReactNode }) {
  const { admin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5 text-sm">
        <Link to="/events" className="flex items-center gap-2.5 font-semibold text-foreground">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4.5" />
          </span>
          <span className="hidden sm:inline">Stall Booking</span>
        </Link>
        {crumb && (
          <>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="truncate font-medium text-foreground">{crumb}</span>
          </>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-3 pl-1.5 text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(admin?.name)}
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="font-medium text-foreground">{admin?.name}</span>
              <span className="text-xs text-muted-foreground">{admin && ROLE_LABEL[admin.role]}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuLabel className="py-2.5">
            <div className="font-medium text-foreground">{admin?.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{admin?.email}</div>
          </DropdownMenuLabel>
          {admin?.role === "SUPER_ADMIN" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="py-2">
                <Link to="/users">
                  <Users />
                  User access
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} variant="destructive" className="py-2">
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
