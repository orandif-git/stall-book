import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { api, type Category, type Event } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutPhotoDialog } from "./LayoutPhotoDialog";

interface Props {
  eventId: string;
  event: Event;
  categories: Category[];
  onChanged: () => void;
}

export function SetupPanel({ eventId, event, categories, onChanged }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryForm eventId={eventId} onChanged={onChanged} />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">{c.code}</TableCell>
                  <TableCell className="text-muted-foreground">{c.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.price)}</TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No categories yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
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
              <Label htmlFor="bg-row">Map row</Label>
              <Input id="bg-row" type="number" value={gridRow} onChange={(e) => setGridRow(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-col">Start column</Label>
              <Input id="bg-col" type="number" value={startCol} onChange={(e) => setStartCol(e.target.value)} required />
            </div>
          </div>
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
