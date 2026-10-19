import type { TimelineId } from "@/lib/schema";

/*
 * Desktop strand-map geometry. Started from the source infographic (1346 × 1361)
 * and extended to fit every series with kits: 1420 × 1520. Every strand runs at
 * 45°, so a station sits on its strand when (y − x) equals the strand's offset
 * (noted per strand below). Work labels step right/down by STEP per line so
 * they never cross their own strand; kit counts sit inline with station titles.
 */

export const VIEWBOX = { w: 1420, h: 1520 } as const;
export const STEP = 24;

export type Pt = readonly [number, number];

export type StationLayout = {
  eraId: string;
  x: number;
  y: number;
  side: "right" | "left" | "along";
  /** work ids drawn on the opposite (left) side, e.g. side stories */
  leftWorks?: string[];
};

export type StrandLayout = {
  timelineId: TimelineId;
  header: { x: number; y: number };
  segments: { from: Pt; to: Pt }[];
  /** dotted run into the Correct Century ring */
  tail?: { from: Pt; to: Pt };
  gaps?: { x1: number; x2: number; y: number; label: string }[];
  stations: StationLayout[];
};

export const CC_RING = { cx: 1420, cy: 1520, r: 222, width: 22 } as const;

export const strands: StrandLayout[] = [
  {
    // offset −305 (segment 1), −170 (segment 2)
    timelineId: "UC",
    header: { x: 318, y: 12 },
    segments: [
      { from: [330, 25], to: [997, 692] },
      { from: [862, 692], to: [1120, 950] },
    ],
    gaps: [
      { x1: 845, x2: 1000, y: 692, label: "\u201CLate UC\u201D Gap" },
      { x1: 1000, x2: 1135, y: 962, label: "UC\u2013RC Gap" },
    ],
    stations: [
      { eraId: "uc-0079-oyw", x: 377, y: 72, side: "right", leftWorks: ["origin", "thunderbolt", "0080"] },
      { eraId: "uc-0083-stardust", x: 505, y: 200, side: "right" },
      { eraId: "uc-0085-gquuuuuux", x: 567, y: 262, side: "right" },
      { eraId: "uc-0087-gryps", x: 629, y: 324, side: "right" },
      { eraId: "uc-0088-neo-zeon", x: 691, y: 386, side: "right" },
      { eraId: "uc-0093-cca", x: 753, y: 448, side: "right" },
      { eraId: "uc-0096-laplace", x: 815, y: 510, side: "right", leftWorks: ["twilight"] },
      { eraId: "uc-0097-phoenix", x: 877, y: 572, side: "right" },
      { eraId: "uc-0105-mafty", x: 939, y: 634, side: "right" },
      { eraId: "uc-0111-formula", x: 890, y: 720, side: "right" },
      { eraId: "uc-0123-cosmo", x: 942, y: 772, side: "right" },
      { eraId: "uc-0133-crossbone", x: 994, y: 824, side: "right" },
      { eraId: "uc-0153-zanscare", x: 1046, y: 876, side: "right" },
      { eraId: "uc-0223-consent", x: 1098, y: 928, side: "right" },
    ],
  },
  {
    // offset −38
    timelineId: "RC",
    header: { x: 0, y: 0 }, // shares the UC–RC gap instead of a header chip
    segments: [{ from: [1000, 962], to: [1130, 1092] }],
    tail: { from: [1130, 1092], to: [1280, 1242] },
    stations: [{ eraId: "rc-1014", x: 1058, y: 1020, side: "right" }],
  },
  {
    // offset −9
    timelineId: "FC",
    header: { x: 588, y: 579 },
    segments: [{ from: [600, 591], to: [1110, 1101] }],
    tail: { from: [1110, 1101], to: [1262, 1253] },
    stations: [{ eraId: "fc-60", x: 636, y: 627, side: "right" }],
  },
  {
    // offset 21
    timelineId: "AC",
    header: { x: 488, y: 663 },
    segments: [{ from: [642, 663], to: [1090, 1111] }],
    tail: { from: [1090, 1111], to: [1238, 1259] },
    stations: [
      { eraId: "ac-195", x: 699, y: 720, side: "left" },
      { eraId: "ac-196", x: 779, y: 800, side: "left" },
    ],
  },
  {
    // offset 60
    timelineId: "AW",
    header: { x: 889, y: 1100 }, // clear of the CE 75 labels
    segments: [{ from: [1040, 1100], to: [1090, 1150] }],
    tail: { from: [1090, 1150], to: [1212, 1272] },
    stations: [{ eraId: "aw-15", x: 1065, y: 1125, side: "left" }],
  },
  {
    // offset 379
    timelineId: "AG",
    header: { x: 824, y: 1176 },
    segments: [{ from: [797, 1176], to: [1141, 1520] }],
    stations: [
      { eraId: "ag-115", x: 873, y: 1252, side: "right" },
      { eraId: "ag-141", x: 929, y: 1308, side: "right" },
      { eraId: "ag-164", x: 985, y: 1364, side: "right" },
    ],
  },
  {
    // offset 418
    timelineId: "AD00",
    header: { x: 188, y: 774 },
    segments: [{ from: [355, 773], to: [1102, 1520] }],
    stations: [
      { eraId: "ad-2307", x: 414, y: 832, side: "left" },
      { eraId: "ad-2312", x: 486, y: 904, side: "left" },
      { eraId: "ad-2313", x: 580, y: 998, side: "left" }, // below the Build header chip
    ],
  },
  {
    // offset 373
    timelineId: "CE",
    header: { x: 393, y: 769 },
    segments: [{ from: [407, 780], to: [1147, 1520] }],
    stations: [
      { eraId: "ce-71", x: 489, y: 862, side: "right" },
      { eraId: "ce-73", x: 585, y: 958, side: "right" },
      { eraId: "ce-75", x: 681, y: 1054, side: "right" },
    ],
  },
  {
    // offset 788 (main), 844 (Real G branch)
    timelineId: "BUILD",
    header: { x: 117, y: 961 },
    segments: [
      { from: [175, 963], to: [732, 1520] },
      { from: [120, 964], to: [300, 1144] },
    ],
    stations: [
      { eraId: "build-2009", x: 164, y: 1008, side: "along" },
      { eraId: "build-8th", x: 260, y: 1048, side: "right" },
      { eraId: "build-11th", x: 329, y: 1117, side: "right" },
      { eraId: "build-cov1", x: 401, y: 1189, side: "right" },
      { eraId: "build-cov2", x: 473, y: 1261, side: "right" },
    ],
  },
  {
    // offset 834
    timelineId: "PD",
    header: { x: 202, y: 1193 },
    segments: [{ from: [370, 1204], to: [686, 1520] }],
    stations: [
      { eraId: "pd-300", x: 386, y: 1220, side: "left" },
      { eraId: "pd-325", x: 450, y: 1284, side: "left" },
    ],
  },
  {
    // offset 1256
    timelineId: "AS",
    header: { x: 22, y: 1279 },
    segments: [{ from: [30, 1286], to: [264, 1520] }],
    stations: [
      { eraId: "as-109", x: 68, y: 1324, side: "right" },
      { eraId: "as-122", x: 128, y: 1384, side: "right" },
    ],
  },
  {
    // offset 252 — SD worlds have no calendar; drawn dashed like the Build universe
    timelineId: "SD",
    header: { x: 40, y: 300 },
    segments: [{ from: [60, 312], to: [250, 502] }],
    stations: [{ eraId: "sd-gaiden", x: 110, y: 362, side: "right" }],
  },
];

/** Position of the i-th work label under a station. */
export function workLabelPos(st: Pick<StationLayout, "x" | "y" | "side">, i: number, onLeft: boolean) {
  if (st.side === "left" || (onLeft && st.side === "right")) {
    const dx = st.side === "left" ? -22 : 4;
    return { x: st.x + dx + STEP * i, y: st.y + 26 + STEP * i, anchor: "end" as const };
  }
  return { x: st.x + 40 + STEP * i, y: st.y + 26 + STEP * i, anchor: "start" as const };
}
