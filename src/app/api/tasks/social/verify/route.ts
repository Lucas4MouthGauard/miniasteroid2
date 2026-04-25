import { NextRequest, NextResponse } from "next/server";
import { verifySocialTask } from "@/lib/server-store";
import type { SocialTaskId } from "@/lib/content";

type VerifyTaskRequest = {
  address?: string;
  taskId?: SocialTaskId;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as VerifyTaskRequest;

  if (!body.address || !body.taskId) {
    return NextResponse.json(
      { ok: false, error: "Address and taskId are required." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      ...verifySocialTask(body.address, body.taskId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Task verification failed.",
      },
      { status: 400 }
    );
  }
}
