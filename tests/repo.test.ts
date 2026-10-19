import { describe, expect, it } from "vitest";
import { db, integrityErrors } from "@/lib/data";
import { GRADE_ROWS, getEraDensity, getEraMatrix, getKit } from "@/lib/repo";
import { validJan } from "@/scripts/ingest/gunplawiki";

const columns = (eraId: string) => getEraMatrix(eraId)!.factions.flatMap((f) => f.columns);
const column = (eraId: string, suitId: string) => columns(eraId).find((c) => c.suit.id === suitId)!;
const kitsOf = (suitId: string) => db.skus.filter((k) => db.molds.find((m) => m.id === k.moldId)!.subjects[0].suitId === suitId);

describe("dataset", () => {
  it("has no integrity errors", () => {
    expect(integrityErrors()).toEqual([]);
  });

  it("flags duplicate JANs", () => {
    const [a, b] = db.skus;
    const bad = { ...db, skus: [{ ...a, jan: "4573102000001" }, { ...b, jan: "4573102000001" }, ...db.skus.slice(2)] };
    expect(integrityErrors(bad).some((e) => e.includes("duplicate JAN"))).toBe(true);
  });

  it("carries no estimated fields", () => {
    for (const m of db.molds) {
      const rec = m as unknown as Record<string, unknown>;
      expect(rec.engineering).toBeUndefined();
      expect(rec.build).toBeUndefined();
    }
    for (const k of db.skus) expect((k as unknown as Record<string, unknown>).status).toBeUndefined();
  });

  it("only states specs a source backs", () => {
    for (const m of db.molds) {
      const sourced = m.provenance.fields;
      if (!sourced.includes("materials")) expect(m.specs.absJoints).toBeUndefined();
      if (!sourced.includes("glue")) expect(m.specs.requiresGlue).toBeUndefined();
      if (sourced.length) expect(m.provenance.refs.some((r) => r.name === "gunpla-wiki")).toBe(true);
    }
  });
});

describe("kit keys", () => {
  it("prefer the Bandai item code, then the JAN", () => {
    const codes = new Set<string>();
    for (const k of db.skus) {
      if (k.bandaiItemCode && !codes.has(k.bandaiItemCode)) expect(k.id).toBe(`bandai-${k.bandaiItemCode}`);
      else if (!k.bandaiItemCode && k.jan) expect(k.id).toBe(`jan-${k.jan}`);
      if (k.bandaiItemCode) codes.add(k.bandaiItemCode);
    }
    expect(db.skus.filter((k) => k.id.startsWith("bandai-")).length).toBeGreaterThan(500);
  });

  it("are unique", () => {
    expect(new Set(db.skus.map((k) => k.id)).size).toBe(db.skus.length);
  });
});

describe("getEraMatrix", () => {
  it("returns null for unknown eras", () => {
    expect(getEraMatrix("nope")).toBeNull();
  });

  it("stacks standard releases first, newest mold on top, then editions", () => {
    const mg = column("uc-0079-oyw", "rx-78-2").cells.MG;
    expect(mg.length).toBeGreaterThan(3);
    const firstEdition = mg.findIndex((c) => c.sku.edition !== "standard");
    const standard = mg.slice(0, firstEdition === -1 ? undefined : firstEdition);
    expect(mg.slice(standard.length).every((c) => c.sku.edition !== "standard")).toBe(true);
    const years = standard.map((c) => c.moldYear);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("leaves never-kitted grades empty (ghost cells)", () => {
    const empty = columns("uc-0087-gryps").some((c) => GRADE_ROWS.some((r) => c.cells[r].length === 0));
    expect(empty).toBe(true);
  });

  it("marks sparse suits compact", () => {
    for (const c of columns("uc-0087-gryps")) expect(c.compact).toBe(c.kitCount <= 2);
  });

  it("nests curated variants right after their parent", () => {
    const parent = column("uc-0079-oyw", "rx-78-2");
    expect(parent.variantIds.length).toBeGreaterThan(0);
    const ids = columns("uc-0079-oyw").map((c) => c.suit.id);
    const i = ids.indexOf("rx-78-2");
    expect(new Set(ids.slice(i + 1, i + 1 + parent.variantIds.length))).toEqual(new Set(parent.variantIds));
  });

  it("covers every grade row", () => {
    expect(Object.keys(column("uc-0079-oyw", "rx-78-2").cells)).toEqual([...GRADE_ROWS]);
  });

  it("density has one entry per column", () => {
    expect(getEraDensity("uc-0088-neo-zeon").length).toBe(columns("uc-0088-neo-zeon").length);
  });
});

describe("getKit", () => {
  it("lists every kit of the suit as lineage", () => {
    const anyGundam = kitsOf("rx-78-2")[0];
    expect(getKit(anyGundam.id)!.lineage.length).toBeGreaterThan(10);
  });

  it("returns sourced dates and citations", () => {
    const zetaKa = kitsOf("msz-006").find((k) => db.molds.find((m) => m.id === k.moldId)!.versionLabel === "Ver.Ka" && k.name.startsWith("MG"))!;
    expect(zetaKa.releaseDate.startsWith("2023-04")).toBe(true);
    expect(zetaKa.provenance.refs[0].license).toMatch(/CC BY-SA/);
  });
});

describe("all timelines", () => {
  it("opens a station on every timeline that has kits", () => {
    const open = new Set(db.eras.filter((e) => e.available).map((e) => e.timelineId));
    for (const t of ["UC", "FC", "AC", "AW", "AG", "AD00", "CE", "BUILD", "PD", "AS", "RC", "CC", "SD"]) expect(open.has(t as never)).toBe(true);
  });

  it("places suits at the station of their series, including newly added stations", () => {
    const at: [string, string][] = [
      ["gat-x105", "ce-71"],
      ["stts-909", "ce-75"], // Rising Freedom: SEED FREEDOM, not CE 71
      ["zgmf-x19a", "ce-73"], // ∞ Justice: had no debut date, was on CE 71
      ["gn-001", "ad-2307"],
      ["gn-0000-gnr-010-00-raiser", "ad-2312"],
      ["msz-006", "uc-0087-gryps"],
      ["rx-178", "uc-0087-gryps"], // infobox says built 0086; Zeta is set in 0087
      ["f91", "uc-0123-cosmo"], // infobox says built 0116; the film is set in 0123
      ["f90", "uc-0111-formula"],
      ["xm-x1", "uc-0133-crossbone"],
      ["rx-0", "uc-0096-laplace"],
      ["gms-gquuuuuux", "uc-0085-gquuuuuux"],
      ["age-3", "ag-164"],
      ["asw-g-08-gundam-barbatos-lupu-3", "pd-325"],
      ["xgf-02", "as-109"],
      ["xvx-016", "as-122"],
      ["knight-gundam", "sd-gaiden"],
    ];
    for (const [id, era] of at) expect([id, db.suits.find((s) => s.id === id)?.debutEraId]).toEqual([id, era]);
  });

  it("never places a suit by default without saying so", () => {
    const undated = db.suits.filter((s) => s.placement?.by === "none");
    expect(undated.length).toBeLessThan(25);
    for (const s of db.suits) expect(s.placement).toBeDefined();
  });

  it("puts year-placed suits on a station at or before their debut, on the right timeline", () => {
    for (const s of db.suits.filter((x) => x.placement?.by === "series")) {
      const era = db.eras.find((e) => e.id === s.debutEraId)!;
      expect(era.available).toBe(true);
    }
  });

  it("takes the first unqualified infobox operator as faction", () => {
    expect(db.suits.find((s) => s.id === "asw-g-08")?.faction).toBe("Tekkadan"); // "Gjallarhorn~Calamity War, Tekkadan"
    expect(db.suits.find((s) => s.id === "msz-006")?.faction).toBe("AEUG");
  });

  it("renders factions beyond the UC set", () => {
    const factions = getEraMatrix("ce-71")!.factions.map((f) => f.faction);
    expect(factions).toEqual(expect.arrayContaining(["ZAFT", "Earth Alliance"]));
  });
});

describe("JANs", () => {
  const withJan = db.skus.filter((k) => k.jan);

  it("are valid EAN-13 and unique", () => {
    expect(withJan.length).toBeGreaterThan(700);
    expect(withJan.every((k) => validJan(k.jan!))).toBe(true);
    expect(new Set(withJan.map((k) => k.jan)).size).toBe(withJan.length);
  });

  it("always carry a citation that publishes them", () => {
    for (const k of withJan) expect((k.janSources ?? []).length).toBeGreaterThan(0);
  });

  it("match the value published on the source page", () => {
    expect(db.skus.some((k) => k.jan === "4573102630308" && k.name.includes("Aerial"))).toBe(true);
  });
});
