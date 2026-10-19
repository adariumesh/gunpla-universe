/*
 * Which station(s) each series belongs to. Structural curation, like the station
 * list itself: it says where a story is set, never anything about a specific kit.
 *
 * Kit rows name the series they come from; a suit is placed at the station of the
 * series most of its kits name. When a series spans several stations (00 seasons,
 * AGE generations, IBO seasons), the suit's in-universe debut year picks among them.
 *
 * Order matters: the first pattern that matches wins, so specific titles come first.
 * Only the part of a series string before " / " or ";" is matched (cross-promotions
 * like "Mobile Suit Gundam / SD Gundam G Generation" place by the first title).
 */

export const SERIES_STATIONS: [RegExp, string[]][] = [
  // ── Build universe (real world) ───────────────────────────────────
  [/build fighters try|honoo try|island wars/i, ["build-11th"]],
  [/build fighters|gm's counterattack|amazing ready|battlogue/i, ["build-8th"]],
  [/build divers re:?rise/i, ["build-cov2"]],
  [/build divers|gbwc|genius head line/i, ["build-cov1"]],
  [/build metaverse|gundam breaker|build real/i, ["build-cov2"]],
  [/gunpla builders/i, ["build-2009"]],

  // ── SD worlds ─────────────────────────────────────────────────────
  // Sangokuden / World Heroes kits are SD versions of existing suits and link to those suits' pages;
  // only SD-original characters with their own pages land here.
  [/sangokuden|world heroes|sangoku/i, ["sd-gaiden"]],
  [/sd gundam gaiden|knight gundam|musha|sd sengokuden|g-vehicle sd|plamo-? ?kyoshiro|dynasty warriors|gundam musou|sd command|g-arms/i, ["sd-gaiden"]],

  // ── Universal Century ─────────────────────────────────────────────
  [/gquuuuuux/i, ["uc-0085-gquuuuuux"]],
  [/crossbone|steel 7|ghost/i, ["uc-0133-crossbone"]],
  [/silhouette formula|gundam f90|f90/i, ["uc-0111-formula"]],
  [/gundam f91|f91 mobile suit variations/i, ["uc-0123-cosmo"]],
  [/victory gundam/i, ["uc-0153-zanscare"]],
  [/g-saviour|g-savior/i, ["uc-0223-consent"]],
  [/hathaway/i, ["uc-0105-mafty"]],
  [/narrative|gundam nt\b/i, ["uc-0097-phoenix"]],
  [/unicorn|twilight axis|one of seventy two|perfectibility/i, ["uc-0096-laplace"]],
  [/char's counterattack|beltorchika|cca-msv|hi-ν|hi-nu|gundam side-f/i, ["uc-0093-cca"]],
  [/gundam zz|gundam sentinel|zz-msv/i, ["uc-0088-neo-zeon"]],
  [/zeta gundam|advance of zeta|z-msv|\bz gundam\b|gundam evolve: 04/i, ["uc-0087-gryps"]],
  [/0083|stardust memory/i, ["uc-0083-stardust"]],
  [/0080|war in the pocket|08th ms team|ms igloo|thunderbolt|blue destiny|origin|one year war|cucuruz doan|rise from the ashes|end of a flash|gihren|mobile suit variation|msv-r|mobile suit discovery|gundam factory yokohama|next future pavilion|gundam g40|^mobile suit gundam( \(novel\))?$/i, ["uc-0079-oyw"]],

  // ── Other timelines ───────────────────────────────────────────────
  [/reconguista|g-reco/i, ["rc-1014"]],
  [/g gundam/i, ["fc-60"]],
  [/endless waltz|glory of (the )?losers|g-unit|dual story/i, ["ac-196"]],
  [/gundam wing/i, ["ac-195"]],
  [/gundam x\b/i, ["aw-15"]],
  [/gundam age/i, ["ag-115", "ag-141", "ag-164"]],
  [/a wakening of the trailblazer|00 the movie/i, ["ad-2313"]],
  [/gundam 00/i, ["ad-2307", "ad-2312"]],
  [/seed freedom/i, ["ce-75"]],
  [/stargazer|seed destiny|destiny astray/i, ["ce-73"]],
  [/seed/i, ["ce-71"]],
  [/iron-blooded orphans|urdr-hunt|gekko/i, ["pd-300", "pd-325"]],
  [/witch from mercury prologue/i, ["as-109"]],
  [/witch from mercury|vanadis heart/i, ["as-122"]],
  [/∀ gundam|turn a gundam/i, ["cc-2345"]],
];

/** Stations for a series string, or undefined when the series isn't tied to a story. */
export function stationsForSeries(series?: string): string[] | undefined {
  if (!series) return undefined;
  const head = series.split(/\s+\/\s+|;/)[0].trim();
  return SERIES_STATIONS.find(([re]) => re.test(head))?.[1];
}
