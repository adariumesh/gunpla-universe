import type { MobileSuit } from "@/lib/schema";

/*
 * Editorial curation only. Facts (name, faction, pilot, debut station) come from
 * the Gundam Wiki infobox during ingestion; from this file the app uses just the
 * variant links (variantOf/variantKind), continuity tag and ordering weight.
 */

const s = (x: Omit<MobileSuit, "continuity"> & { continuity?: MobileSuit["continuity"] }): MobileSuit => ({
  continuity: "main",
  ...x,
});

export const suits: MobileSuit[] = [
  // UC 0079
  s({ id: "rx-78-2", modelNumber: "RX-78-2", name: "Gundam", faction: "EFSF", pilot: "Amuro Ray", debutEraId: "uc-0079-oyw", canonWeight: 100 }),
  s({ id: "rx-78-3", modelNumber: "RX-78-3", name: "G-3 Gundam", faction: "EFSF", variantOf: "rx-78-2", variantKind: "prototype-sibling", debutEraId: "uc-0079-oyw", canonWeight: 40 }),
  s({ id: "rx-78-02", modelNumber: "RX-78-02", name: "Gundam (The Origin)", faction: "EFSF", variantOf: "rx-78-2", variantKind: "continuity-reinterpretation", continuity: "origin", debutEraId: "uc-0079-oyw", canonWeight: 45 }),
  s({ id: "rgm-79", modelNumber: "RGM-79", name: "GM", faction: "EFSF", debutEraId: "uc-0079-oyw", canonWeight: 60 }),
  s({ id: "ms-06f", modelNumber: "MS-06F", name: "Zaku II", faction: "Zeon", debutEraId: "uc-0079-oyw", canonWeight: 90 }),
  s({ id: "ms-06s", modelNumber: "MS-06S", name: "Char's Zaku II", faction: "Zeon", pilot: "Char Aznable", variantOf: "ms-06f", variantKind: "pilot-custom", debutEraId: "uc-0079-oyw", canonWeight: 85 }),
  s({ id: "ms-07b", modelNumber: "MS-07B", name: "Gouf", faction: "Zeon", pilot: "Ramba Ral", debutEraId: "uc-0079-oyw", canonWeight: 60 }),
  s({ id: "ms-09", modelNumber: "MS-09", name: "Dom", faction: "Zeon", debutEraId: "uc-0079-oyw", canonWeight: 58 }),

  // UC 0083
  s({ id: "rx-78gp01", modelNumber: "RX-78GP01", name: "Gundam “Zephyranthes”", faction: "EFSF", pilot: "Kou Uraki", debutEraId: "uc-0083-stardust", canonWeight: 80 }),
  s({ id: "rx-78gp01fb", modelNumber: "RX-78GP01Fb", name: "Zephyranthes Full Burnern", faction: "EFSF", variantOf: "rx-78gp01", variantKind: "refit", debutEraId: "uc-0083-stardust", canonWeight: 50 }),
  s({ id: "rx-78gp02a", modelNumber: "RX-78GP02A", name: "Gundam “Physalis”", faction: "Zeon", pilot: "Anavel Gato", debutEraId: "uc-0083-stardust", canonWeight: 72 }),

  // UC 0087
  s({ id: "msz-006", modelNumber: "MSZ-006", name: "Zeta Gundam", faction: "AEUG", pilot: "Kamille Bidan", debutEraId: "uc-0087-gryps", canonWeight: 95 }),
  s({ id: "rx-178", modelNumber: "RX-178", name: "Gundam Mk-II", faction: "AEUG", debutEraId: "uc-0087-gryps", canonWeight: 80 }),
  s({ id: "msn-00100", modelNumber: "MSN-00100", name: "Hyaku Shiki", faction: "AEUG", pilot: "Quattro Bajeena", debutEraId: "uc-0087-gryps", canonWeight: 75 }),
  s({ id: "rms-099", modelNumber: "RMS-099", name: "Rick Dias", faction: "AEUG", debutEraId: "uc-0087-gryps", canonWeight: 52 }),
  s({ id: "pmx-003", modelNumber: "PMX-003", name: "The O", faction: "Titans", pilot: "Paptimus Scirocco", debutEraId: "uc-0087-gryps", canonWeight: 62 }),
  s({ id: "amx-003", modelNumber: "AMX-003", name: "Gaza-C", faction: "Axis", debutEraId: "uc-0087-gryps", canonWeight: 30 }),
  s({ id: "amx-004", modelNumber: "AMX-004", name: "Qubeley", faction: "Axis", pilot: "Haman Karn", debutEraId: "uc-0087-gryps", canonWeight: 75 }),

  // UC 0088
  s({ id: "msz-010", modelNumber: "MSZ-010", name: "ZZ Gundam", faction: "AEUG", pilot: "Judau Ashta", debutEraId: "uc-0088-neo-zeon", canonWeight: 85 }),

  // UC 0093
  s({ id: "rx-93", modelNumber: "RX-93", name: "ν Gundam", faction: "Londo Bell", pilot: "Amuro Ray", debutEraId: "uc-0093-cca", canonWeight: 100 }),
  s({ id: "msn-04", modelNumber: "MSN-04", name: "Sazabi", faction: "Neo Zeon", pilot: "Char Aznable", debutEraId: "uc-0093-cca", canonWeight: 95 }),
  s({ id: "rgm-89", modelNumber: "RGM-89", name: "Jegan", faction: "Londo Bell", debutEraId: "uc-0093-cca", canonWeight: 50 }),
  s({ id: "ams-119", modelNumber: "AMS-119", name: "Geara Doga", faction: "Neo Zeon", debutEraId: "uc-0093-cca", canonWeight: 50 }),
];
