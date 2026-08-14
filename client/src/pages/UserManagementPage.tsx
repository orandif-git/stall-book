import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api, type AdminUser, type BookedByOrg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/status";
import { Topbar } from "../components/Topbar";
import { OrgToggle } from "../components/OrgToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Role = "SUPER_ADMIN" | "STAFF";

export function UserManagementPage() {
  const { admin: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  async function load() {
    const { data } = await api.get<AdminUser[]>("/admin-users");
    setUsers(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeUser(id: string) {
    await api.delete(`/admin-users/${id}`);
    load();
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Topbar crumb="User access" />
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Admin users</h1>
            <p className="text-sm text-muted-foreground">
              Everyone has the same access to bookings, stalls, and reports — only super admins can manage users.
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus />
            Add user
          </Button>
        </div>

        {users === null && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        )}

        {users && users.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">
                      {u.name}
                      {u.id === me?.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "SUPER_ADMIN" ? "default" : "outline"} className="gap-1">
                        {u.role === "SUPER_ADMIN" && <ShieldCheck className="size-3" />}
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="Edit user" onClick={() => setEditing(u)}>
                          <Pencil />
                        </Button>
                        {u.id !== me?.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Reset password"
                              onClick={() => setResetting(u)}
                            >
                              <KeyRound />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon-sm" title="Remove user">
                                  <Trash2 className="text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {u.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    They'll immediately lose access to this account. This can't be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction variant="destructive" onClick={() => removeUser(u.id)}>
                                    Remove user
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>

      {showForm && <AddUserSheet onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}

      {editing && (
        <EditUserSheet
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function AddUserSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [bookedByOrg, setBookedByOrg] = useState<BookedByOrg>("MEC");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/admin-users", { name, email, password, role, bookedByOrg });
      onCreated();
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Add user</SheetTitle>
          <SheetDescription>They'll be able to sign in and manage bookings right away.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form id="add-user-form" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="au-name">Name</Label>
              <Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-email">Email</Label>
              <Input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-password">Password</Label>
              <Input
                id="au-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">{ROLE_LABEL.STAFF}</SelectItem>
                  <SelectItem value="SUPER_ADMIN">{ROLE_LABEL.SUPER_ADMIN}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL.STAFF} has the same access as {ROLE_LABEL.SUPER_ADMIN}, except managing users.
              </p>
            </div>
            {role === "STAFF" && (
              <div className="space-y-1.5">
                <OrgToggle value={bookedByOrg} onChange={setBookedByOrg} />
                <p className="text-xs text-muted-foreground">
                  Their bookings will be recorded under this org automatically — they won't see this choice in the
                  booking form.
                </p>
              </div>
            )}
          </form>
        </div>

        <SheetFooter>
          <Button type="submit" form="add-user-form" disabled={submitting}>
            {submitting ? "Creating…" : "Create user"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EditUserSheet({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [bookedByOrg, setBookedByOrg] = useState<BookedByOrg>(user.bookedByOrg);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.patch(`/admin-users/${user.id}`, { name, email, role, bookedByOrg });
      onSaved();
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit user</SheetTitle>
          <SheetDescription>Update their name, email, or role.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form id="edit-user-form" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="eu-name">Name</Label>
              <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-email">Email</Label>
              <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isSelf}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">{ROLE_LABEL.STAFF}</SelectItem>
                  <SelectItem value="SUPER_ADMIN">{ROLE_LABEL.SUPER_ADMIN}</SelectItem>
                </SelectContent>
              </Select>
              {isSelf && <p className="text-xs text-muted-foreground">You can't change your own role.</p>}
            </div>
            {role === "STAFF" && (
              <div className="space-y-1.5">
                <OrgToggle value={bookedByOrg} onChange={setBookedByOrg} />
                <p className="text-xs text-muted-foreground">
                  Their bookings will be recorded under this org automatically — they won't see this choice in the
                  booking form.
                </p>
              </div>
            )}
          </form>
        </div>

        <SheetFooter>
          <Button type="submit" form="edit-user-form" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/admin-users/${user.id}/reset-password`, { newPassword });
      setDone(true);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          {!done && <DialogDescription>Set a new password for {user.name}. They'll need to use it next time they sign in.</DialogDescription>}
        </DialogHeader>

        {done ? (
          <p className="py-4 text-sm text-foreground">Password updated for {user.name}.</p>
        ) : (
          <>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <form id="reset-password-form" onSubmit={onSubmit} className="space-y-1.5">
              <Label htmlFor="rp-password">New password</Label>
              <Input
                id="rp-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </form>
          </>
        )}

        <DialogFooter>
          {done ? (
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          ) : (
            <Button type="submit" form="reset-password-form" className="w-full" disabled={submitting}>
              {submitting ? "Resetting…" : "Reset password"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function axiosMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } }).response;
    const e = response?.data?.error;
    if (typeof e === "string") return e;
    if (e) return JSON.stringify(e);
  }
  return "Something went wrong";
}
