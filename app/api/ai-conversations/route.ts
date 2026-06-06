import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const convIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("ai_messages")
    .select("conversation_id, role, content, created_at")
    .eq("user_id", user.id)
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true });

  const messagesByConv = new Map<string, typeof messages>();
  for (const msg of messages ?? []) {
    const arr = messagesByConv.get(msg.conversation_id) ?? [];
    arr.push(msg);
    messagesByConv.set(msg.conversation_id, arr);
  }

  const result = conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    messages: (messagesByConv.get(conv.id) ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  }));

  return NextResponse.json({ conversations: result });
}
