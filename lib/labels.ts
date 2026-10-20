// Display constants shared by server code and client components. Keep this file
// free of data imports: anything a client component imports from here is
// bundled for the browser, and lib/repo pulls in the whole catalog.
import type { Grade, MobileSuit } from "./schema";

export const GRADE_ROWS = ["VINTAGE", "HG", "RG", "MG", "PG", "EG", "OTHER"] as const;
export type GradeRow = (typeof GRADE_ROWS)[number];

export const GRADE_ROW_LABEL: Record<GradeRow, string> = {
  VINTAGE: "Vintage",
  HG: "HG / HGUC",
  RG: "Real Grade",
  MG: "Master Grade",
  PG: "Perfect Grade",
  EG: "Entry Grade",
  OTHER: "FG · SD · MEGA",
};

export function gradeRow(g: Grade): GradeRow {
  return (GRADE_ROWS as readonly string[]).includes(g) ? (g as GradeRow) : "OTHER";
}

/** "RX-78-2 Gundam"; just the name when the source has no separate model number. */
export function suitLabel(s: Pick<MobileSuit, "modelNumber" | "name">): string {
  return s.name.toUpperCase().startsWith(s.modelNumber.toUpperCase()) ? s.name : `${s.modelNumber} ${s.name}`;
}
