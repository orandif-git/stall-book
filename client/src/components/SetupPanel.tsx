import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Pencil, Upload } from "lucide-react";
import { api, type Category, type Event } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LayoutPhotoDialog } from "./LayoutPhotoDialog";
import { ActivityTimeline } from "./ActivityTimeline";

interface Props {
  eventId: string;
  event: Event;
  categories: Category[];
  onChanged: () => void;
}

export function SetupPanel({ eventId, event, categories, onChanged }: Props) {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === "SUPER_ADMIN";
  const [editing, setEditing] = useState<Category | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isSuperAdmin && <CategoryForm eventId={eventId} onChanged={onChanged} />}
        <BulkGenerateForm eventId={eventId} categories={categories} onChanged={onChanged} />
        <LayoutImageCard eventId={eventId} event={event} onChanged={onChanged} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Categories</h3>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Price</TableHead>
                {isSuperAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">{c.code}</TableCell>
                  <TableCell className="text-muted-foreground">{c.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.price)}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" title="Edit category" onClick={() => setEditing(c)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 4 : 3} className="text-center text-muted-foreground">
                    No categories yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {editing && (
        <EditCategorySheet
          eventId={eventId}
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(updated);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function CategoryForm({ eventId, onChanged }: { eventId: string; onChanged: () => void }) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.post(`/events/${eventId}/categories`, { code, label, size: size || undefined, price: Number(price) });
    setCode("");
    setLabel("");
    setSize("");
    setPrice("");
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add category</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-code">Code</Label>
            <Input id="cat-code" placeholder="e.g. B" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-label">Label</Label>
            <Input
              id="cat-label"
              placeholder="e.g. 2.5M x 2.5M (B1 to B41)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-size">Size (optional)</Label>
            <Input id="cat-size" value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-price">Price</Label>
            <Input id="cat-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">
            Add category
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EditCategorySheet({
  eventId,
  category,
  onClose,
  onSaved,
}: {
  eventId: string;
  category: Category;
  onClose: () => void;
  onSaved: (updated: Category) => void;
}) {
  const [code, setCode] = useState(category.code);
  const [label, setLabel] = useState(category.label);
  const [size, setSize] = useState(category.size ?? "");
  const [price, setPrice] = useState(String(category.price));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.patch<Category>(`/events/${eventId}/categories/${category.id}`, {
        code,
        label,
        size: size || undefined,
        price: Number(price),
      });
      onSaved(data);
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
          <SheetTitle>Edit category</SheetTitle>
          <SheetDescription>Changes apply to this category only, not existing stall prices retroactively shown elsewhere.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form id="edit-category-form" onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec-code">Code</Label>
              <Input id="ec-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-label">Label</Label>
              <Input id="ec-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-size">Size (optional)</Label>
              <Input id="ec-size" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-price">Price</Label>
              <Input id="ec-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </form>

          <Separator />

          <ActivityTimeline entries={category.activity} />
        </div>

        <SheetFooter>
          <Button type="submit" form="edit-category-form" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BulkGenerateForm({
  eventId,
  categories,
  onChanged,
}: {
  eventId: string;
  categories: Category[];
  onChanged: () => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [prefix, setPrefix] = useState("");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const [gridRow, setGridRow] = useState("1");
  const [startCol, setStartCol] = useState("1");
  const [afterCode, setAfterCode] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setAfterCode(null);
      return;
    }
    setLoadingSuggestion(true);
    api
      .get<{
        gridRow: number;
        startCol: number;
        suggestedPrefix: string;
        suggestedFrom: number;
        afterCode: string | null;
      }>(`/events/${eventId}/stalls/next-position`, { params: { categoryId } })
      .then(({ data }) => {
        setPrefix(data.suggestedPrefix);
        setFrom(String(data.suggestedFrom));
        setTo(String(data.suggestedFrom));
        setGridRow(String(data.gridRow));
        setStartCol(String(data.startCol));
        setAfterCode(data.afterCode);
      })
      .finally(() => setLoadingSuggestion(false));
  }, [eventId, categoryId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) return;
    await api.post(`/events/${eventId}/stalls/bulk-generate`, {
      categoryId,
      prefix,
      from: Number(from),
      to: Number(to),
      gridRow: Number(gridRow),
      startCol: Number(startCol),
    });
    onChanged();
  }

  const codesPreview =
    prefix && from && to ? (from === to ? `${prefix}${from}` : `${prefix}${from}–${prefix}${to}`) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk-generate stalls</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bg-prefix">Prefix</Label>
            <Input id="bg-prefix" placeholder="e.g. B" value={prefix} onChange={(e) => setPrefix(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bg-from">From</Label>
              <Input id="bg-from" type="number" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-to">To</Label>
              <Input id="bg-to" type="number" value={to} onChange={(e) => setTo(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bg-row">Position on grid — row</Label>
              <Input id="bg-row" type="number" value={gridRow} onChange={(e) => setGridRow(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-col">column</Label>
              <Input id="bg-col" type="number" value={startCol} onChange={(e) => setStartCol(e.target.value)} required />
            </div>
          </div>
          {categoryId && (
            <p className="text-xs text-muted-foreground">
              {loadingSuggestion
                ? "Finding where this category's stalls end…"
                : afterCode
                  ? `Auto-filled to continue right after ${afterCode} — change only if you want this placed elsewhere.`
                  : "This category has no stalls yet, so a new row was suggested."}
            </p>
          )}
          {codesPreview && (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
              Will add: <span className="font-medium">{codesPreview}</span>
              {afterCode ? ` — right after ${afterCode}` : " — as a new row"}
            </p>
          )}
          <Button type="submit" className="w-full">
            Generate stalls
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LayoutImageCard({ eventId, event, onChanged }: { eventId: string; event: Event; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      await api.post(`/events/${eventId}/layout-image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChanged();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layout image</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.layoutImageUrl && (
          <img
            src={event.layoutImageUrl}
            alt="Event layout"
            className="max-h-40 w-full rounded-md border border-border object-contain"
          />
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload />
            {event.layoutImageUrl ? "Replace image" : "Upload image"}
          </Button>
          {event.layoutImageUrl && (
            <LayoutPhotoDialog
              imageUrl={event.layoutImageUrl}
              trigger={<Button variant="outline">View full size</Button>}
            />
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        <p className="text-xs text-muted-foreground">
          Reference photo only — for admins to view alongside the grid, not for booking.
        </p>
      </CardContent>
    </Card>
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
