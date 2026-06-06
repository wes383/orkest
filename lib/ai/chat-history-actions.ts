"use server";

import { createClient } from "@/lib/supabase/server-client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const MAX_CONVERSATIONS_PER_USER = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

// --- Types ---

interface MessagePayload {
  id: string;
  role: string;
  content: Json;
  createdAt?: string;
}

// --- Auth helper ---

async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// --- Create conversation ---

export async function createConversationAction(
  messages: MessagePayload[],
): Promise<{ id: string; title: string } | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const admin = createAdminClient();

  // Clean up old conversations
  await cleanupOldConversations(admin, userId);

  const title = extractTitle(messages);

  const { data, error } = await admin
    .from("ai_conversations")
    .insert({ user_id: userId, title })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create conversation:", error);
    return null;
  }

  const conversationId = data.id;

  // Insert messages
  if (messages.length > 0) {
    const trimmed = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
    const inserts = trimmed.map((msg) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
    }));

    const { error: msgError } = await admin.from("ai_messages").insert(inserts);
    if (msgError) {
      console.error("Failed to insert messages:", msgError);
    }
  }

  return { id: conversationId, title };
}

// --- Append messages (append-only, no delete-all) ---

export async function appendMessagesAction(
  conversationId: string,
  newMessages: MessagePayload[],
): Promise<boolean> {
  const userId = await getAuthUserId();
  if (!userId) return false;

  const admin = createAdminClient();

  // Verify ownership
  const { data: conv } = await admin
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) return false;

  // Count existing messages
  const { count } = await admin
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  const currentCount = count ?? 0;
  const totalAfterAppend = currentCount + newMessages.length;

  // Insert new messages
  if (newMessages.length > 0) {
    const inserts = newMessages.map((msg) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
    }));

    const { error } = await admin.from("ai_messages").insert(inserts);
    if (error) {
      console.error("Failed to append messages:", error);
      return false;
    }
  }

  // Update conversation timestamp
  await admin
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // If total exceeds limit, delete oldest messages (simple truncation)
  if (totalAfterAppend > MAX_MESSAGES_PER_CONVERSATION) {
    await trimOldMessages(admin, conversationId, totalAfterAppend);
  }

  return true;
}

// --- Full sync (replace all messages — used as fallback) ---

export async function syncMessagesAction(
  conversationId: string,
  allMessages: MessagePayload[],
): Promise<boolean> {
  const userId = await getAuthUserId();
  if (!userId) return false;

  const admin = createAdminClient();

  // Verify ownership
  const { data: conv } = await admin
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) return false;

  const trimmed = allMessages.slice(-MAX_MESSAGES_PER_CONVERSATION);

  // Delete old messages and insert new ones
  await admin
    .from("ai_messages")
    .delete()
    .eq("conversation_id", conversationId);

  if (trimmed.length > 0) {
    const inserts = trimmed.map((msg) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
    }));

    const { error } = await admin.from("ai_messages").insert(inserts);
    if (error) {
      console.error("Failed to sync messages:", error);
      return false;
    }
  }

  // Update conversation timestamp
  await admin
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return true;
}

// --- Delete conversation ---

export async function deleteConversationAction(
  conversationId: string,
): Promise<boolean> {
  const userId = await getAuthUserId();
  if (!userId) return false;

  const admin = createAdminClient();

  const { error } = await admin
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete conversation:", error);
    return false;
  }

  return true;
}

// --- Load conversation messages ---

export async function loadConversationMessagesAction(
  conversationId: string,
): Promise<Json[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ai_messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load messages:", error);
    return [];
  }

  return (data ?? []).map((msg) => msg.content);
}

// --- Internal helpers ---

function extractTitle(messages: MessagePayload[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New conversation";

  const content = firstUserMessage.content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (content && typeof content === "object") {
    const obj = content as { content?: string; parts?: { type: string; text?: string }[] };
    if (typeof obj.content === "string") {
      text = obj.content;
    } else if (Array.isArray(obj.parts)) {
      text = obj.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
    }
  }

  if (!text) return "New conversation";
  return text.length > 50 ? text.slice(0, 50) + "..." : text;
}

async function cleanupOldConversations(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<void> {
  const { count } = await admin
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) >= MAX_CONVERSATIONS_PER_USER) {
    const { data: oldConversations } = await admin
      .from("ai_conversations")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true })
      .limit((count ?? 0) - MAX_CONVERSATIONS_PER_USER + 1);

    if (oldConversations && oldConversations.length > 0) {
      await admin
        .from("ai_conversations")
        .delete()
        .in("id", oldConversations.map((c) => c.id));
    }
  }
}

async function trimOldMessages(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  currentCount: number,
): Promise<void> {
  // Simply delete the oldest messages to stay within the limit
  const excess = currentCount - MAX_MESSAGES_PER_CONVERSATION;
  if (excess <= 0) return;

  const { data: oldestMessages } = await admin
    .from("ai_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(excess);

  if (oldestMessages && oldestMessages.length > 0) {
    await admin
      .from("ai_messages")
      .delete()
      .in("id", oldestMessages.map((m) => m.id));
  }
}
