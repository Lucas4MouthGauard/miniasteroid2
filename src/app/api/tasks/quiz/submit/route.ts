import { NextRequest, NextResponse } from "next/server";
import { submitQuiz } from "@/lib/server-store";
import type { QuizChoice } from "@/lib/content";

type SubmitQuizRequest = {
  address?: string;
  answers?: Record<number, QuizChoice | null>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SubmitQuizRequest;

  if (!body.address || !body.answers) {
    return NextResponse.json(
      { ok: false, error: "Address and answers are required." },
      { status: 400 }
    );
  }

  try {
    const payload = submitQuiz(body.address, body.answers);

    return NextResponse.json({
      ok: true,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Quiz submission failed.",
      },
      { status: 400 }
    );
  }
}
