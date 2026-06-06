import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { fetchUserMemories, deleteMemory } from "@/lib/ai/memory";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await fetchUserMemories(supabase, user.id);
  return NextResponse.json({ memories });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await deleteMemory(supabase, user.id, id);
  return NextResponse.json({ success: true });
}
