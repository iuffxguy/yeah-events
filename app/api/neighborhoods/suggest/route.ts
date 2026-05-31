import { NextRequest, NextResponse } from "next/server";
import { askForJson, systemPrompt } from "@/lib/anthropic";

type NeighborhoodSuggestion = { name: string; slug: string };

export async function POST(request: NextRequest) {
  try {
    const { cityName } = await request.json();

    if (!cityName) {
      return NextResponse.json(
        { error: "cityName is required" },
        { status: 400 }
      );
    }

    const suggestions = await askForJson<NeighborhoodSuggestion[]>(
      systemPrompt(
        "a local city expert who knows neighborhood names across US cities"
      ),
      `List the 15 most well-known and distinct neighborhoods in ${cityName}.
Return a JSON array of objects with "name" (proper display name) and "slug" (lowercase-hyphenated).
Example: [{"name": "South End", "slug": "south-end"}]`
    );

    return NextResponse.json({ neighborhoods: suggestions });
  } catch (err: unknown) {
    console.error("[POST /api/neighborhoods/suggest]", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
