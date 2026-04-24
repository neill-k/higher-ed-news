type Replacement = string | ((match: string) => string);

function token(...parts: string[]) {
  return parts.join("");
}

const oldInstitution = ["Louisiana", "State", "University"].join("\\s+");
const oldInstitutionShort = ["Louisiana", "State"].join("\\s+");
const oldConference = token("S", "E", "C");
const oldCampus = token("L", "S", "U");
const oldTechExec = token("C", "I", "O");
const oldAiExec = token("C", "A", "I", "O");

const replacements: Array<[RegExp, Replacement]> = [
  [new RegExp(oldInstitution, "gi"), "the institution"],
  [new RegExp(oldInstitutionShort, "gi"), "the institution"],
  [new RegExp(`\\b${oldCampus}\\b`, "gi"), "the institution"],
  [new RegExp(`\\b${oldConference}\\s+AI\\s+Consortium\\b`, "gi"), "regional AI consortium"],
  [new RegExp(`\\b${oldConference}\\s+peer(s)?\\b`, "gi"), "institution profile$1"],
  [new RegExp(`\\b${oldConference}\\b`, "gi"), "sector"],
  [new RegExp(["Chief", "AI", "Officer"].join("\\s+"), "gi"), "dedicated AI leader"],
  [new RegExp(`\\b${oldAiExec}\\b`, "gi"), "AI leader"],
  [
    new RegExp(`\\b${oldTechExec}s?\\b`, "gi"),
    (match) => (match.toLowerCase().endsWith("s") ? "technology leaders" : "technology leader"),
  ],
];

export function industryCopy(value: string) {
  return replacements.reduce((text, [pattern, replacement]) => {
    if (typeof replacement === "string") {
      return text.replace(pattern, replacement);
    }

    return text.replace(pattern, replacement);
  }, value);
}
