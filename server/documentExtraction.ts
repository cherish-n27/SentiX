import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WordExtractor from "word-extractor";

const MAX_WORD_BYTES = 8 * 1024 * 1024;

export async function extractLegacyWordText(fileName: string, contentBase64: string) {
  const buffer = Buffer.from(contentBase64, "base64");
  if (!buffer.length || buffer.length > MAX_WORD_BYTES) throw new Error("The legacy Word file must be smaller than 8 MB.");
  const folder = await mkdtemp(join(tmpdir(), "sentix-doc-"));
  const filePath = join(folder, fileName.replace(/[^a-zA-Z0-9._-]/g, "_"));
  try {
    await writeFile(filePath, buffer);
    const document = await new WordExtractor().extract(filePath);
    return document.getBody().trim();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
