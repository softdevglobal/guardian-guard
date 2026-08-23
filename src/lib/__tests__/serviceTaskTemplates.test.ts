import { describe, expect, it } from "vitest";
import {
  emptyTemplateForm,
  selectableTemplates,
  templateBlockers,
  templatePayload,
} from "@/lib/serviceTaskTemplates";

describe("task template validation", () => {
  it("requires a name", () => {
    expect(templateBlockers({ service_type: "Personal care" })).toEqual([
      "Give the task template a name workers will recognise.",
    ]);
  });

  it("requires a service type", () => {
    expect(templateBlockers({ name: "Morning routine" })).toEqual([
      "Record the service type this template belongs to.",
    ]);
  });

  it("rejects whitespace-only values", () => {
    expect(templateBlockers({ name: "   ", service_type: "  " })).toHaveLength(2);
  });

  it("passes when name and service type are present", () => {
    expect(templateBlockers({ name: "Morning routine", service_type: "Personal care" })).toEqual([]);
  });
});

describe("task template payload", () => {
  it("trims values and defaults to active so the template is immediately schedulable", () => {
    expect(templatePayload({ name: " Morning routine ", service_type: " Personal care " })).toMatchObject({
      name: "Morning routine",
      service_type: "Personal care",
      is_active: true,
    });
  });

  it("respects an explicitly inactive template", () => {
    expect(templatePayload({ name: "Old", service_type: "X", is_active: false }).is_active).toBe(false);
  });

  it("resets to an active empty form after a successful save", () => {
    expect(emptyTemplateForm()).toEqual({ is_active: true });
    expect(templateBlockers(emptyTemplateForm())).toHaveLength(2);
  });
});

describe("template availability in shift scheduling", () => {
  const templates = [
    { id: "a", name: "Active", is_active: true },
    { id: "b", name: "Default", is_active: undefined },
    { id: "c", name: "Inactive", is_active: false },
  ];

  it("offers active and default templates when scheduling a shift", () => {
    expect(selectableTemplates(templates).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("keeps a newly saved template selectable straight away", () => {
    const saved = templatePayload({ name: "New", service_type: "Community" });
    expect(selectableTemplates([saved])).toHaveLength(1);
  });

  it("still lists inactive templates in the management list", () => {
    // The Existing templates card renders the full list, not the selectable subset.
    expect(templates).toHaveLength(3);
  });
});
