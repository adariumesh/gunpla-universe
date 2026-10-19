import type { TimelineId } from "@/lib/schema";

/*
 * Desktop strand-map geometry, in the coordinate space of the source
 * infographic (1346 × 1361). Every strand runs at 45°, so a station sits on
 * its strand when (y − x) matches the strand's offset. Work labels step
 * right/down by STEP per line so they never cross their own strand.
 */

export const VIEWBOX = { w: 1346, h: 1361 } as const;
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

export const CC_RING = { cx: 1346, cy: 1361, r: 222, width: 22 } as const;

export const strands: StrandLayout[] = [
  {
    timelineId: "UC",
    header: { x: 318, y: 12 },
    segments: [
      { from: [330, 25], to: [997, 692] },
      { from: [862, 692], to: [1080, 910] },
    ],
    gaps: [
      { x1: 845, x2: 1000, y: 692, label: "“Late UC” Gap" },
      { x1: 958, x2: 1095, y: 922, label: "UC–RC Gap" },
    ],
    stations: [
      { eraId: "uc-0079-oyw", x: 377, y: 72, side: "right", leftWorks: ["origin", "thunderbolt", "0080"] },
      { eraId: "uc-0083-stardust", x: 507, y: 202, side: "right" },
      { eraId: "uc-0087-gryps", x: 578, y: 273, side: "right" },
      { eraId: "uc-0088-neo-zeon", x: 650, y: 345, side: "right" },
      { eraId: "uc-0093-cca", x: 721, y: 416, side: "right" },
      { eraId: "uc-0096-laplace", x: 793, y: 488, side: "right", leftWorks: ["twilight"] },
      { eraId: "uc-0097-phoenix", x: 865, y: 560, side: "right" },
      { eraId: "uc-0105-mafty", x: 937, y: 632, side: "right" },
      { eraId: "uc-0123-cosmo", x: 892, y: 722, side: "right" },
      { eraId: "uc-0153-zanscare", x: 963, y: 793, side: "right" },
      { eraId: "uc-0223-consent", x: 1036, y: 866, side: "right" },
    ],
  },
  {
    timelineId: "RC",
    header: { x: 0, y: 0 }, // shares the UC–RC gap instead of a header chip
    segments: [{ from: [960, 922], to: [1095, 1057] }],
    tail: { from: [1095, 1057], to: [1200, 1162] },
    stations: [{ eraId: "rc-1014", x: 1018, y: 980, side: "right" }],
  },
  {
    timelineId: "FC",
    header: { x: 588, y: 579 },
    segments: [{ from: [600, 591], to: [1110, 1101] }],
    tail: { from: [1110, 1101], to: [1192, 1183] },
    stations: [{ eraId: "fc-60", x: 636, y: 627, side: "right" }],
  },
  {
    timelineId: "AC",
    header: { x: 488, y: 663 },
    segments: [{ from: [642, 663], to: [1090, 1111] }],
    tail: { from: [1090, 1111], to: [1168, 1189] },
    stations: [
      { eraId: "ac-195", x: 699, y: 720, side: "left" },
      { eraId: "ac-196", x: 779, y: 800, side: "left" },
    ],
  },
  {
    timelineId: "AW",
    header: { x: 842, y: 1041 },
    segments: [{ from: [980, 1040], to: [1060, 1120] }],
    tail: { from: [1060, 1120], to: [1142, 1202] },
    stations: [{ eraId: "aw-15", x: 1032, y: 1092, side: "left" }],
  },
  {
    timelineId: "AG",
    header: { x: 824, y: 1176 },
    segments: [{ from: [797, 1176], to: [982, 1361] }],
    stations: [{ eraId: "ag-115", x: 873, y: 1252, side: "right" }],
  },
  {
    timelineId: "AD00",
    header: { x: 188, y: 774 },
    segments: [{ from: [355, 773], to: [943, 1361] }],
    stations: [
      { eraId: "ad-2307", x: 414, y: 832, side: "left" },
      { eraId: "ad-2313", x: 486, y: 904, side: "left" },
    ],
  },
  {
    timelineId: "CE",
    header: { x: 393, y: 769 },
    segments: [{ from: [407, 780], to: [988, 1361] }],
    stations: [
      { eraId: "ce-71", x: 489, y: 862, side: "right" },
      { eraId: "ce-73", x: 585, y: 958, side: "right" },
    ],
  },
  {
    timelineId: "BUILD",
    header: { x: 117, y: 961 },
    segments: [
      { from: [175, 963], to: [573, 1361] },
      { from: [120, 964], to: [300, 1144] },
    ],
    stations: [
      { eraId: "build-2009", x: 164, y: 1008, side: "along" },
      { eraId: "build-8th", x: 200, y: 988, side: "right" },
      { eraId: "build-11th", x: 269, y: 1057, side: "right" },
      { eraId: "build-cov1", x: 341, y: 1129, side: "right" },
      { eraId: "build-cov2", x: 413, y: 1201, side: "right" },
    ],
  },
  {
    timelineId: "PD",
    header: { x: 202, y: 1193 },
    segments: [{ from: [370, 1204], to: [527, 1361] }],
    stations: [{ eraId: "pd-300", x: 386, y: 1220, side: "left" }],
  },
  {
    timelineId: "AS",
    header: { x: 22, y: 1279 },
    segments: [{ from: [30, 1286], to: [105, 1361] }],
    stations: [{ eraId: "as-109", x: 68, y: 1324, side: "right" }],
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
