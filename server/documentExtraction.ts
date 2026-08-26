import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WordExtractor from "word-extractor";

const MAX_LEGACY_WORD_BYTES = 8 * 1024 * 1024;

export async function extractLegacyWordText(fileName: string, contentBase64: string) {
  const fileBuffer = Buffer.from(contentBase64, "base64");
  if (!fileBuffer.length || fileBuffer.length > MAX_LEGACY_WORD_BYTES) {
    throw new Error("The Word document must be between 1 byte and 8 MB.");
  }

  const workspace = await mkdtemp(join(tmpdir(), "sentix-word-"));
  const filePath = join(workspace, fileName.replace(/[^a-zA-Z0-9._-]/g, "_"));
  try {
    await writeFile(filePath, fileBuffer);
    const extractor = new WordExtractor();
    const document = await extractor.extract(filePath);
    return document.getBody().trim();
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
