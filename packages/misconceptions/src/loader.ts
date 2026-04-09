import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as yaml from "js-yaml";
import {
  misconceptionLibrarySchema,
  type MisconceptionEntry,
  type GradeBand,
} from "./schema";

let _library: MisconceptionEntry[] | null = null;

function getLibraryDir(): string {
  // Support both ESM (import.meta.url) and CJS (__dirname)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, "../library");
  } catch {
    // Fallback for environments where import.meta.url is not available
    return path.resolve(process.cwd(), "library");
  }
}

export function loadLibrary(): MisconceptionEntry[] {
  if (_library) return _library;

  const entries: unknown[] = [];
  const libraryDir = getLibraryDir();

  // Dynamically scan all .yaml files — new domains are added by dropping a YAML file
  const yamlFiles = fs.readdirSync(libraryDir).filter((f) => f.endsWith(".yaml"));
  for (const file of yamlFiles) {
    const filePath = path.join(libraryDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = yaml.load(content);
    if (Array.isArray(parsed)) {
      entries.push(...parsed);
    }
  }

  _library = misconceptionLibrarySchema.parse(entries);
  return _library;
}

export function getMisconceptionsByDomainAndBand(
  domain: string,
  gradeBand: GradeBand
): MisconceptionEntry[] {
  return loadLibrary().filter(
    (e) => e.domain === domain && e.grade_band === gradeBand
  );
}

export function getMisconceptionById(id: string): MisconceptionEntry | undefined {
  return loadLibrary().find((e) => e.id === id);
}

export function resetLibraryCache(): void {
  _library = null;
}
