import { describe, expect, it } from "vitest";
import { parseMerch } from "@/scripts/ingest/merch";

const page = `{{Infobox/Gundam/Merchandise
|prefix=HGTWFM
|merchandise={{merch
|cover=HG Gundam Lfrith.jpg
|number=1
|title=Gundam Lfrith
|id=JAN 4573102629449
|dt=2022-08-06
|yen=1600
|s=Mobile Suit Gundam the Witch from Mercury PROLOGUE
|m=XGF-02 Gundam Lfrith
|gpl=HGTWFM XGF-02 Gundam Lfrith
|man=https://manual.bandai-hobby.net/menus/detail/127
}}{{merch
|title=Bad Check Digit
|id=JAN 4573102629448
|dt=February 2004
|m=MD-0031 Dilanza, MD-0031L Lauda's Dilanza
}}{{merch
|title=A Book
|id=ISBN 9784048000000
|dt=2023
}}
}}`;

describe("parseMerch", () => {
  const rows = parseMerch(page);

  it("reads every {{merch}} entry", () => {
    expect(rows.map((r) => r.title)).toEqual(["Gundam Lfrith", "Bad Check Digit", "A Book"]);
  });

  it("keeps the stated fields", () => {
    expect(rows[0]).toMatchObject({
      number: 1,
      jan: "4573102629449",
      releaseDate: "2022-08-06",
      yen: 1600,
      suitPages: ["XGF-02 Gundam Lfrith"],
      gunplaWiki: "HGTWFM XGF-02 Gundam Lfrith",
      manualId: "127",
    });
  });

  it("keeps a JAN only when stated as a JAN and the check digit holds", () => {
    expect(rows[1].jan).toBeUndefined();
    expect(rows[2].jan).toBeUndefined();
  });

  it("splits multi-suit rows and parses prose dates", () => {
    expect(rows[1].suitPages).toEqual(["MD-0031 Dilanza", "MD-0031L Lauda's Dilanza"]);
    expect(rows[1].releaseDate).toBe("2004-02");
  });
});
