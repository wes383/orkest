"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  createConversationAction,
  appendMessagesAction,
  syncMessagesAction,
  deleteConversationAction,
  loadConversationMessagesAction,
} from "@/lib/ai/chat-history-actions";
import type { OrkestAIMessage } from "@/lib/ai/chat-types";
import type { Json } from "@/lib/supabase/database.types";

export interface AiChatConversation {
  id: string;
  title: string;
  createdAt: number;
  messages: OrkestAIMessage[];
}

const MAX_MESSAGES_PER_CONVERSATION = 100;

function extractTitle(messages: OrkestAIMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New conversation";

  const text = (firstUserMessage.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");

  if (!text) return "New conversation";
  return text.length > 50 ? text.slice(0, 50) + "..." : text;
}

function messageToPayload(msg: OrkestAIMessage) {
  return {
    id: msg.id,
    role: msg.role,
    content: msg as unknown as Json,
  };
}

export function useAiChatHistory(userId?: string) {
  const [conversations, setConversations] = useState<AiChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the last saved message IDs per conversation to enable append-only writes
  const lastSavedMessageIdsRef = useRef<Map<string, Set<string>>>(new Map());

  // Load conversations from cloud
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function loadConversations() {
      try {
        // Use dynamic import to avoid bundling supabase client in the initial load
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const { data, error } = await supabase
          .from("ai_conversations")
          .select("id, title, created_at, updated_at")
          .eq("user_id", userId!)
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("Failed to load conversations:", error);
          setLoading(false);
          return;
        }

        const loadedConversations: AiChatConversation[] = (data ?? []).map((conv) => ({
          id: conv.id,
          title: conv.title,
          createdAt: new Date(conv.created_at).getTime(),
          messages: [],
        }));

        setConversations(loadedConversations);
      } catch (err) {
        console.error("Failed to load conversations:", err);
      }
      setLoading(false);
    }

    loadConversations();
  }, [userId]);

  // Load messages for a specific conversation
  const loadConversationMessages = useCallback(
    async (conversationId: string): Promise<OrkestAIMessage[]> => {
      if (!userId) return [];

      try {
        const contents = await loadConversationMessagesAction(conversationId);
        const messages = contents as unknown as OrkestAIMessage[];

        // Update the saved IDs tracker
        const idSet = new Set(messages.map((m) => m.id));
        lastSavedMessageIdsRef.current.set(conversationId, idSet);

        return messages;
      } catch (err) {
        console.error("Failed to load messages:", err);
        return [];
      }
    },
    [userId],
  );

  const createConversation = useCallback(
    async (messages: OrkestAIMessage[]) => {
      const trimmedMessages = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);

      if (!userId) {
        const id = crypto.randomUUID();
        const title = extractTitle(trimmedMessages);
        const conversation: AiChatConversation = {
          id,
          title,
          createdAt: Date.now(),
          messages: trimmedMessages,
        };
        setConversations((prev) => [conversation, ...prev]);
        setCurrentConversationId(id);
        return id;
      }

      const title = extractTitle(trimmedMessages);

      const result = await createConversationAction(trimmedMessages.map(messageToPayload));

      if (!result) {
        // Fallback to local-only
        const id = crypto.randomUUID();
        const conversation: AiChatConversation = {
          id,
          title,
          createdAt: Date.now(),
          messages: trimmedMessages,
        };
        setConversations((prev) => [conversation, ...prev]);
        setCurrentConversationId(id);
        return id;
      }

      const conversationId = result.id;

      // Track saved message IDs
      const idSet = new Set(trimmedMessages.map((m) => m.id));
      lastSavedMessageIdsRef.current.set(conversationId, idSet);

      const conversation: AiChatConversation = {
        id: conversationId,
        title: result.title || title,
        createdAt: Date.now(),
        messages: trimmedMessages,
      };

      setConversations((prev) => [conversation, ...prev]);
      setCurrentConversationId(conversationId);
      return conversationId;
    },
    [userId],
  );

  const updateConversation = useCallback(
    async (id: string, messages: OrkestAIMessage[]) => {
      const trimmedMessages = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);

      if (!userId) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, messages: trimmedMessages, createdAt: Date.now() } : c))
        );
        return;
      }

      // Determine new messages since last save (append-only optimization)
      const lastSavedIds = lastSavedMessageIdsRef.current.get(id);
      const currentIds = new Set(trimmedMessages.map((m) => m.id));

      if (lastSavedIds) {
        const newMessages = trimmedMessages.filter((m) => !lastSavedIds.has(m.id));

        if (newMessages.length > 0 && newMessages.length < trimmedMessages.length) {
          // Append-only: only send new messages
          const success = await appendMessagesAction(id, newMessages.map(messageToPayload));

          if (success) {
            lastSavedMessageIdsRef.current.set(id, currentIds);
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, messages: trimmedMessages, createdAt: Date.now() } : c))
            );
            return;
          }

          // Fallback to full sync if append fails
        }

        // If all messages are new or append failed, use full sync
        if (newMessages.length === trimmedMessages.length) {
          // All messages are new — use append
          const success = await appendMessagesAction(id, newMessages.map(messageToPayload));
          if (success) {
            lastSavedMessageIdsRef.current.set(id, currentIds);
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, messages: trimmedMessages, createdAt: Date.now() } : c))
            );
            return;
          }
        }
      }

      // Full sync fallback (delete all + re-insert)
      const success = await syncMessagesAction(id, trimmedMessages.map(messageToPayload));

      if (success) {
        lastSavedMessageIdsRef.current.set(id, currentIds);
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, messages: trimmedMessages, createdAt: Date.now() } : c))
      );
    },
    [userId],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!userId) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (currentConversationId === id) {
          setCurrentConversationId(null);
        }
        return;
      }

      await deleteConversationAction(id);

      // Clean up saved IDs tracker
      lastSavedMessageIdsRef.current.delete(id);

      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [userId, currentConversationId],
  );

  return {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    updateConversation,
    deleteConversation,
    loadConversationMessages,
    loading,
  };
}
