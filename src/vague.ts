import { writeFile } from "fs/promises";
import { fromFile } from "vague-lang";

export interface GenerateDataOptions {
  seed?: number;
}

/** Generate data with Vague and persist it as formatted JSON. */
export async function generateData(
  vagueFile: string,
  outputFile: string,
  options: GenerateDataOptions = {}
): Promise<Record<string, unknown[]>> {
  const data = await fromFile(vagueFile, options);
  await writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  return data;
}
