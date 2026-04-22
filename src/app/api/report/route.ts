import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const REPORT_ARTIFACTS = {
  json: {
    fileName: "report-data.json",
    paths: [
      path.join(process.cwd(), "output", "report-data.json"),
      path.join(process.cwd(), "src", "data", "report-data.json"),
    ],
  },
  markdown: {
    fileName: "report.md",
    paths: [
      path.join(process.cwd(), "output", "report.md"),
      path.join(process.cwd(), "src", "data", "report.md"),
    ],
  },
} as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const artifact =
    url.searchParams.get("format") === "json"
      ? REPORT_ARTIFACTS.json
      : REPORT_ARTIFACTS.markdown;

  for (const filePath of artifact.paths) {
    try {
      const contents = await readFile(filePath, "utf8");

      return new Response(contents, {
        headers: {
          "content-type":
            artifact.fileName.endsWith(".json")
              ? "application/json; charset=utf-8"
              : "text/markdown; charset=utf-8",
          "content-disposition": `inline; filename="${artifact.fileName}"`,
        },
      });
    } catch {
      // Try the next candidate path.
    }
  }

  return NextResponse.json(
    { error: "Report artifact not found. Run the pipeline first." },
    { status: 404 },
  );
}

