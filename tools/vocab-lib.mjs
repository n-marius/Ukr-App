// Gemeinsame Regeln für Vokabeln (Import, Index, Prüfung). Format: docs/VOKABEL-VORLAGE.md, SPEC.md Abschnitt 12.
export const POS = ["Subst", "Verb", "Adj", "Adv", "Pron", "Num", "Präp", "Konj", "Part", "Interj", "Wendung"];
export const GEN = ["m", "f", "n", "pl"];
export const ASP = ["ipf", "pf"];
export const FIELDS = ["id", "uk", "a", "de", "alt", "pos", "gen", "asp", "forms", "zusatz", "korrigiert"];

const ACUTE = /́/g;
export const stripAccent = (s) => String(s ?? "").normalize("NFC").replace(ACUTE, "");
const VOWELS = /[аеєиіїоуюя]/gi;

// Vergleichsform: ohne Betonung, klein, ohne führenden Artikel/„sich“, ohne Klammerzusätze.
export function norm(s) {
  return stripAccent(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^(sich|der|die|das|ein|eine|einen)\s+/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function validateWord(w, where) {
  const errors = [];
  const warnings = [];
  const fail = (m) => errors.push(`${where}: ${m}`);
  const warn = (m) => warnings.push(`${where}: ${m}`);

  for (const k of Object.keys(w)) if (!FIELDS.includes(k)) fail(`unbekanntes Feld '${k}'`);
  if (typeof w.uk !== "string" || !w.uk.trim()) fail("'uk' fehlt");
  else if (!/[Ѐ-ӿ]/.test(w.uk)) fail("'uk' enthält keine kyrillischen Buchstaben");
  else if (/́/.test(w.uk)) fail("'uk' darf keine Betonungszeichen enthalten (dafür gibt es 'a')");
  if (typeof w.de !== "string" || !w.de.trim()) fail("'de' fehlt");
  if (!POS.includes(w.pos)) fail(`'pos' muss einer von ${POS.join(", ")} sein`);

  if (typeof w.a !== "string" || !w.a.trim()) fail("'a' (Form mit Betonungszeichen) fehlt");
  else {
    if (stripAccent(w.a).toLowerCase() !== String(w.uk ?? "").normalize("NFC").toLowerCase()) fail(`'a' (${w.a}) weicht ohne Betonungszeichen von 'uk' (${w.uk}) ab`);
    if (/[^аеєиіїоуюяАЕЄИІЇОУЮЯ]\u0301/.test(w.a.normalize("NFC"))) fail(`'a' (${w.a}): Betonungszeichen muss auf einem Vokal stehen`);
    const vowels = (stripAccent(w.uk ?? "").match(VOWELS) ?? []).length;
    if (w.pos !== "Wendung" && vowels >= 2 && !ACUTE.test(w.a.normalize("NFC"))) warn("mehrsilbig, aber 'a' ohne Betonungszeichen");
    ACUTE.lastIndex = 0;
  }

  if ("alt" in w && !(Array.isArray(w.alt) && w.alt.length > 0 && w.alt.every((x) => typeof x === "string" && x.trim()))) fail("'alt' muss eine nicht leere Liste von Texten sein");
  if ("gen" in w) {
    if (!GEN.includes(w.gen)) fail(`'gen' muss einer von ${GEN.join(", ")} sein`);
    else if (w.pos !== "Subst") warn("'gen' ist nur für Substantive vorgesehen");
  }
  if ("asp" in w) {
    if (!ASP.includes(w.asp)) fail(`'asp' muss einer von ${ASP.join(", ")} sein`);
    else if (w.pos !== "Verb") warn("'asp' ist nur für Verben vorgesehen");
  }
  for (const k of ["forms", "zusatz"]) if (k in w && (typeof w[k] !== "string" || !w[k].trim())) fail(`'${k}' muss ein nicht leerer Text sein`);
  if ("korrigiert" in w && Number.isNaN(Date.parse(w.korrigiert))) fail("'korrigiert' ist kein Zeitstempel");
  if (w.pos === "Subst" && !("gen" in w)) warn("Substantiv ohne 'gen'");
  return { errors, warnings };
}

// Schlüssel zur Erkennung von Doppelten: gleiches ukrainisches Wort, gleiche deutsche Bedeutung, gleiche Wortart.
export const dupKey = (w) => `${norm(w.uk)}|${norm(w.de)}|${w.pos}|${norm(w.zusatz ?? "")}`;

export const formatId = (n) => `v${String(n).padStart(4, "0")}`;
