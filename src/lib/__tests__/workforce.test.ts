import { describe, expect, it } from "vitest";
import {
  availableOnWeekday,
  siteBlockers,
  summariseAvailability,
  workerBlockers,
  workerPayload,
  workerSchedulingBlockers,
} from "@/lib/workforce";

describe("siteBlockers", () => {
  it("requires a name, a type and a sane geofence", () => {
    expect(siteBlockers({})).toEqual([
      "Site name is required.",
      "Select a site type.",
      "Geofence radius must be between 25 and 5000 metres.",
    ]);
  });

  it("rejects a malformed postcode", () => {
    const blockers = siteBlockers({ name: "Depot", site_type: "depot", geofence_radius_metres: 150, postcode: "12a" });
    expect(blockers).toEqual(["Postcode must be four digits."]);
  });

  it("passes a complete site", () => {
    expect(siteBlockers({ name: "Head office", site_type: "office", geofence_radius_metres: 150, postcode: "3000" })).toEqual([]);
  });
});

describe("workerBlockers", () => {
  it("requires an account, an employment type and a position", () => {
    expect(workerBlockers({})).toHaveLength(3);
  });

  it("rejects a negative pay rate and an end date before the start date", () => {
    const blockers = workerBlockers({
      user_id: "u1",
      employment_type: "casual",
      position: "Support worker",
      pay_rate: -5,
      start_date: "2026-02-01",
      end_date: "2026-01-01",
    });
    expect(blockers).toEqual(["Pay rate must be a positive amount.", "End date cannot be before the start date."]);
  });
});

describe("workerPayload", () => {
  it("normalises comma lists and blank numbers", () => {
    const payload = workerPayload({ user_id: "u1", position: " Support worker ", pay_rate: "", skills: "manual handling, driving", qualifications: "" } as any);
    expect(payload.skills).toEqual(["manual handling", "driving"]);
    expect(payload.qualifications).toEqual([]);
    expect(payload.pay_rate).toBeNull();
    expect(payload.position).toBe("Support worker");
  });
});

describe("workerSchedulingBlockers", () => {
  it("blocks inactive or unscreened workers", () => {
    expect(workerSchedulingBlockers({ employment_status: "on_leave", screening_status: "verified" })).toEqual([
      "Worker is not currently active.",
    ]);
    expect(workerSchedulingBlockers({ employment_status: "active", screening_status: "pending" })).toEqual([
      "Worker screening is not verified.",
    ]);
  });

  it("blocks shifts after employment ended", () => {
    expect(
      workerSchedulingBlockers({ employment_status: "active", screening_status: "verified", end_date: "2026-01-01" }, "2026-02-01")
    ).toEqual(["Worker employment ended before this date."]);
  });

  it("clears an active, verified worker", () => {
    expect(workerSchedulingBlockers({ employment_status: "active", screening_status: "verified" })).toEqual([]);
  });
});

describe("availability", () => {
  it("treats an unrecorded pattern as available", () => {
    expect(availableOnWeekday({}, "mon")).toBe(true);
    expect(summariseAvailability({})).toBe("Not recorded");
  });

  it("respects a recorded pattern", () => {
    expect(availableOnWeekday({ availability: { mon: true } }, "tue")).toBe(false);
    expect(summariseAvailability({ mon: true, tue: true })).toBe("Mon, Tue");
  });
});
