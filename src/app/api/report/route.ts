import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "markdown";
  const fileName = format === "json" ? "report-data.json" : "report.md";
  const filePath = path.join(process.cwd(), "output", fileName);

  try {
    const contents = await readFile(filePath, "utf8");

    return new Response(contents, {
      headers: {
        "content-type":
          format === "json"
            ? "application/json; charset=utf-8"
            : "text/markdown; charset=utf-8",
        "content-disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Report artifact not found. Run the pipeline first." },
      { status: 404 },
    );
  }
}

