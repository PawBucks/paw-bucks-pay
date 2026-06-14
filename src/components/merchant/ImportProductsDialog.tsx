import { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

type RawRow = Record<string, unknown>;

type ParsedRow = {
  name: string;
  description?: string;
  priceUsd: number | "";
  pawbucksPrice?: number | "";
  category?: string;
  stock?: number | "";
  imageUrl?: string;
  itemType?: "product" | "service";
};

type RowResult = {
  row: number;
  name: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
};

const TEMPLATE_COLUMNS = [
  "name",
  "description",
  "priceUsd",
  "pawbucksPrice",
  "category",
  "stock",
  "imageUrl",
  "itemType",
];

const TEMPLATE_SAMPLE: ParsedRow[] = [
  {
    name: "Premium Salmon Treats",
    description: "All-natural wild-caught salmon training treats",
    priceUsd: 12.99,
    pawbucksPrice: 1299,
    category: "Treats",
    stock: 50,
    imageUrl: "",
    itemType: "product",
  },
  {
    name: "Nail Trim Service",
    description: "Quick & gentle nail trim",
    priceUsd: 15.0,
    pawbucksPrice: 1500,
    category: "Grooming",
    stock: 999,
    imageUrl: "",
    itemType: "service",
  },
];

function normalizeHeader(h: string): string {
  const k = h.toLowerCase().replace(/[\s_-]+/g, "");
  if (k === "name" || k === "productname" || k === "title") return "name";
  if (k === "description" || k === "desc") return "description";
  if (k === "price" || k === "priceusd" || k === "usd" || k === "amount") return "priceUsd";
  if (k === "pawbucks" || k === "pawbucksprice" || k === "pb" || k === "pricepawbucks")
    return "pawbucksPrice";
  if (k === "category" || k === "type") return "category";
  if (k === "stock" || k === "quantity" || k === "qty" || k === "inventory") return "stock";
  if (k === "image" || k === "imageurl" || k === "imageurls" || k === "photo") return "imageUrl";
  if (k === "itemtype" || k === "kind") return "itemType";
  return h;
}

function mapRow(raw: RawRow): ParsedRow {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    out[normalizeHeader(key)] = raw[key];
  }
  const itemType = (out.itemType ?? "product").toString().toLowerCase();
  return {
    name: (out.name ?? "").toString().trim(),
    description: out.description ? String(out.description) : "",
    priceUsd: out.priceUsd === "" || out.priceUsd == null ? "" : Number(out.priceUsd),
    pawbucksPrice:
      out.pawbucksPrice === "" || out.pawbucksPrice == null ? "" : Number(out.pawbucksPrice),
    category: out.category ? String(out.category) : "",
    stock: out.stock === "" || out.stock == null ? "" : Number(out.stock),
    imageUrl: out.imageUrl ? String(out.imageUrl) : "",
    itemType: itemType === "service" ? "service" : "product",
  };
}

function downloadTemplate(format: "csv" | "xlsx") {
  if (format === "csv") {
    const csv = Papa.unparse({ fields: TEMPLATE_COLUMNS, data: TEMPLATE_SAMPLE });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, "pawbucks-inventory-template.csv");
  } else {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_SAMPLE, { header: TEMPLATE_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    triggerDownload(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "pawbucks-inventory-template.xlsx"
    );
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export const ImportProductsDialog = ({ open, onOpenChange, onImported }: Props) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const reset = () => {
    setRows([]);
    setFilename("");
    setParseError("");
    setResults(null);
  };

  const handleFile = async (file: File) => {
    setParseError("");
    setResults(null);
    setFilename(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      let parsed: RawRow[] = [];
      if (ext === "csv") {
        const text = await file.text();
        const result = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
        if (result.errors.length) {
          setParseError(result.errors[0].message);
          return;
        }
        parsed = result.data;
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        parsed = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
      } else {
        setParseError("Unsupported file type. Upload a .csv or .xlsx file.");
        return;
      }

      const mapped = parsed.map(mapRow).filter((r) => r.name);
      if (mapped.length === 0) {
        setParseError("No valid rows found. Make sure your file has a 'name' column.");
        return;
      }
      if (mapped.length > 500) {
        setParseError("Maximum 500 rows per import. Split your file.");
        return;
      }
      setRows(mapped);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse file");
    }
  };

  const invalidCount = rows.filter(
    (r) => !r.name || typeof r.priceUsd !== "number" || r.priceUsd < 0.5
  ).length;

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-import-products", {
        body: { rows },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Import failed");
      setResults(data.results as RowResult[]);
      const s = data.summary as { created: number; updated: number; errored: number };
      toast.success(
        `Import complete: ${s.created} created, ${s.updated} updated${
          s.errored ? `, ${s.errored} failed` : ""
        }`
      );
      onImported?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-w-3xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Inventory
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to bulk import products into your storefront. Rows whose
            name matches an existing product will update that product.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
          {!results && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate("csv")}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV template
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate("xlsx")}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel template
                </Button>
              </div>

              <label
                htmlFor="inventory-file"
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm font-medium">
                  {filename ? filename : "Click to upload CSV or Excel"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Required column: name &middot; Recommended: priceUsd, pawbucksPrice, stock
                </div>
                <input
                  id="inventory-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>

              {parseError && (
                <Alert variant="destructive">
                  <AlertTitle>Could not read file</AlertTitle>
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}

              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {rows.length} row{rows.length === 1 ? "" : "s"} ready
                      {invalidCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {invalidCount} invalid
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={reset}>
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="border rounded-md max-h-72 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>PawBucks</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 50).map((r, i) => {
                          const invalid =
                            !r.name || typeof r.priceUsd !== "number" || r.priceUsd < 0.5;
                          return (
                            <TableRow key={i} className={invalid ? "bg-destructive/5" : ""}>
                              <TableCell className="font-medium">{r.name || "—"}</TableCell>
                              <TableCell>
                                {typeof r.priceUsd === "number"
                                  ? `$${r.priceUsd.toFixed(2)}`
                                  : "—"}
                              </TableCell>
                              <TableCell>{r.pawbucksPrice || "—"}</TableCell>
                              <TableCell>{r.stock === "" ? "999" : r.stock}</TableCell>
                              <TableCell className="capitalize">{r.itemType}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {rows.length > 50 && (
                    <p className="text-xs text-muted-foreground">
                      Showing first 50 of {rows.length} rows.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <Alert>
                <AlertTitle>Import results</AlertTitle>
                <AlertDescription>
                  {results.filter((r) => r.status === "created").length} created,{" "}
                  {results.filter((r) => r.status === "updated").length} updated,{" "}
                  {results.filter((r) => r.status === "error").length} failed.
                </AlertDescription>
              </Alert>
              <div className="border rounded-md max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell>{r.name || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "error"
                                ? "destructive"
                                : r.status === "updated"
                                ? "secondary"
                                : "default"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.message || ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button
              onClick={handleImport}
              disabled={importing || rows.length === 0 || invalidCount === rows.length}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" /> Import {rows.length || ""} item
                  {rows.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProductsDialog;