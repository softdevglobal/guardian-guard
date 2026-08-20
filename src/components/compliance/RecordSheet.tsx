import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BlockerAlert } from "@/components/compliance/GateUI";

export type FieldType = "text" | "textarea" | "number" | "date" | "datetime" | "checkbox" | "select";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  help?: string;
  required?: boolean;
  /** Hide the field unless the predicate passes (e.g. only when a checkbox is ticked). */
  showIf?: (values: Record<string, any>) => boolean;
}

export type RecordValues = Record<string, any>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fields: FieldDef[];
  initial?: RecordValues;
  /** Returns human-readable reasons why saving is blocked. Empty array allows the save. */
  blockers?: (values: RecordValues) => string[];
  onSubmit: (values: RecordValues) => Promise<void> | void;
  submitLabel?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
}

export function RecordSheet({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  blockers,
  onSubmit,
  submitLabel = "Save record",
  readOnly = false,
  readOnlyReason,
}: Props) {
  const [values, setValues] = useState<RecordValues>(initial ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues(initial ?? {});
  }, [open, initial]);

  const set = (name: string, value: any) => setValues((v) => ({ ...v, [name]: value }));
  const visible = fields.filter((f) => !f.showIf || f.showIf(values));
  const missingRequired = visible
    .filter((f) => f.required && (values[f.name] === undefined || values[f.name] === null || String(values[f.name]).trim() === ""))
    .map((f) => `${f.label} is required.`);
  const gateBlockers = blockers ? blockers(values) : [];
  const allBlockers = [...missingRequired, ...gateBlockers];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allBlockers.length > 0 || readOnly) return;
    setSaving(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {readOnly && readOnlyReason && <BlockerAlert blockers={[readOnlyReason]} title="Read only" />}
          {!readOnly && <BlockerAlert blockers={allBlockers} title="This record cannot be saved yet" />}

          {visible.map((f) => {
            const id = `field-${f.name}`;
            const value = values[f.name];
            return (
              <div key={f.name} className="space-y-1.5">
                {f.type === "checkbox" ? (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={id}
                      checked={!!value}
                      disabled={readOnly}
                      onCheckedChange={(c) => set(f.name, c === true)}
                    />
                    <Label htmlFor={id} className="font-normal leading-snug">
                      {f.label}
                    </Label>
                  </div>
                ) : (
                  <>
                    <Label htmlFor={id}>
                      {f.label}
                      {f.required && <span className="text-destructive" aria-hidden="true"> *</span>}
                    </Label>
                    {f.type === "textarea" && (
                      <Textarea id={id} value={value ?? ""} disabled={readOnly} rows={3} onChange={(e) => set(f.name, e.target.value)} />
                    )}
                    {f.type === "select" && (
                      <Select value={value ?? ""} disabled={readOnly} onValueChange={(v) => set(f.name, v)}>
                        <SelectTrigger id={id}>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {["text", "number", "date", "datetime"].includes(f.type) && (
                      <Input
                        id={id}
                        type={f.type === "datetime" ? "datetime-local" : f.type}
                        value={value ?? ""}
                        disabled={readOnly}
                        onChange={(e) => set(f.name, f.type === "number" ? Number(e.target.value) : e.target.value)}
                      />
                    )}
                  </>
                )}
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={readOnly || saving || allBlockers.length > 0}>
              {saving ? "Saving…" : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
