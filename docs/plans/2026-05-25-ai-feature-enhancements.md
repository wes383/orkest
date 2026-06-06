# AI 功能增强实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AI 助手增加 5 项功能：状态切换、周排程、主动建议、时间估算、批量完成

**Architecture:** 所有新功能以 tool 形式添加到 `buildTools()` 中，复用现有的 `AiProposedAction` 提案机制。状态切换需要扩展 `ItemFormState` 和 `itemFormPatchSchema` 以支持 `status` 字段。主动建议在 AI 面板展开时通过轻量 API 调用生成提示。时间估算基于 focus session 历史数据。

**Tech Stack:** Next.js API routes, Zod schemas, AI SDK tools, Supabase

---

### Task 1: 支持任务状态切换（completed / in_progress / active）

当前 `ItemFormState` 和 `itemFormPatchSchema` 没有 `status` 字段，AI 无法将任务标记为完成或进行中。

**Files:**
- Modify: `lib/types/all-page.ts` — ItemFormState 增加 status 字段
- Modify: `lib/ai/chat-utils.ts` — formFromAiItem 传递 status
- Modify: `app/api/ai-chat/route.ts` — itemFormPatchSchema 增加 status
- Modify: `lib/all-page-utils.ts` — buildRecordFromForm 使用 form.status

**Step 1: ItemFormState 增加 status 字段**

在 `lib/types/all-page.ts` 的 `ItemFormState` 类型中增加：

```typescript
// 在 ItemFormState 末尾添加
status: ItemStatus | undefined;
```

**Step 2: formFromAiItem 传递 status**

在 `lib/ai/chat-utils.ts` 的 `formFromAiItem` 函数中增加：

```typescript
status: item.status,
```

同时更新 `createEmptyAiForm` 返回值增加 `status: undefined`。

**Step 3: itemFormPatchSchema 增加 status**

在 `app/api/ai-chat/route.ts` 的 `itemFormPatchSchema` 中增加：

```typescript
status: z.enum(["active", "completed"]).optional(),
```

注意：当前项目 UI 只使用 `active` 和 `completed` 两个状态，与用户界面的二元切换保持一致。

**Step 4: buildRecordFromForm 使用 form.status**

在 `lib/all-page-utils.ts` 的 `buildRecordFromForm` 中，将 status 赋值逻辑改为：

```typescript
status: form.status
  ?? (recurrenceType !== "none" ? "active" : undefined)
  ?? existingManualItem?.status
  ?? baseItem?.status
  ?? "active",
```

优先使用 form 中显式设置的 status。

**Step 5: 添加 proposeStatusChange tool**

在 `app/api/ai-chat/route.ts` 的 `buildTools` 中添加新 tool：

```typescript
proposeStatusChange: tool({
  description: "Mark tasks as completed or reactivate them. Use to mark tasks as done or undo completion. For completing recurring tasks on a specific date, prefer completing the occurrence rather than the whole series.",
  inputSchema: z.object({
    updates: z.array(z.object({
      targetItemId: z.string(),
      newStatus: z.enum(["active", "completed"]),
      reason: z.string().optional(),
    })),
  }),
  execute: async ({ updates }): Promise<AiToolResult> => {
    const proposedActions = updates
      .map((update) => {
        const target = findItem(context, update.targetItemId);
        if (!target) return null;
        const before = formFromAiItem(target);
        const after = { ...before, status: update.newStatus };
        return {
          id: makeActionId("status"),
          type: "update_item" as const,
          title: update.newStatus === "completed"
            ? `Complete ${before.title}`
            : `Reactivate ${before.title}`,
          targetItemId: update.targetItemId,
          patch: { status: update.newStatus },
          before,
          after,
          reason: update.reason,
        };
      })
      .filter((a): a is AiProposedAction => Boolean(a));

    const summaries = proposedActions.slice(0, 3).map((a) => `'${a.title}'`).join(", ");
    return { message: `Prepared ${proposedActions.length} status change(s): ${summaries}.`, proposedActions };
  },
}),
```

**Step 6: 更新 system prompt**

在 system prompt 中增加状态切换的说明：

```
When the user asks to mark tasks as done, complete, or finished, use proposeStatusChange. To reactivate a completed task, use proposeStatusChange with newStatus "active". Do not use proposeUpdateItems for status changes.
```

**Step 7: 更新 AiBatchPreviewItem 处理**

在 `lib/hooks/use-ai-chat.ts` 的 `handleApplyBatch` 中，确认 `applyAiUpdates` 能正确处理含 `status` 的 `formState`。由于 `buildRecordFromForm` 已支持 `form.status`，无需额外修改。

**Step 8: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

**Step 9: Commit**

```bash
git add lib/types/all-page.ts lib/ai/chat-utils.ts app/api/ai-chat/route.ts lib/all-page-utils.ts
git commit -m "feat: add status field to ItemFormState and proposeStatusChange AI tool"
```

---

### Task 2: 周排程（planMyWeek）

扩展 planMyDay 的逻辑，支持跨天分配任务。

**Files:**
- Modify: `app/api/ai-chat/route.ts` — 添加 planMyWeek tool

**Step 1: 添加 planMyWeek tool**

在 `buildTools` 中添加。核心逻辑：遍历未来 7 天，每天复用 planMyDay 的空闲时段计算和任务分配逻辑，将未排完的任务顺延到下一天。

```typescript
planMyWeek: tool({
  description: "Plan the user's week (next 7 days). Distributes overdue and unscheduled tasks across available time slots, respecting priorities, due dates, and sleep hours. Use when the user says 'plan my week', 'schedule this week', 'organize my week', etc.",
  inputSchema: z.object({
    days: z.number().int().min(1).max(7).default(7).describe("Number of days to plan starting from today."),
    maxItemsPerDay: z.number().int().min(1).max(15).default(10).describe("Max tasks to schedule per day."),
    reason: z.string().optional(),
  }),
  execute: async ({ days, maxItemsPerDay, reason }): Promise<AiToolResult> => {
    const today = context.today;
    const proposedActions: AiProposedAction[] = [];
    const scheduledItems = new Set<string>(); // track items already scheduled

    for (let d = 0; d < days; d++) {
      const dateObj = new Date(today + "T12:00:00");
      dateObj.setDate(dateObj.getDate() + d);
      const dateStr = dateObj.toISOString().slice(0, 10);

      // Get timed items for this date
      const dayTimed = context.items.filter(
        (item) =>
          doesItemOccurOnDate(item, dateStr, context.timezone) &&
          item.hasTime && item.startTime && !item.allDay &&
          !isItemTerminalOnDate(item, dateStr, context.timezone),
      );

      const busySlots = dayTimed
        .map((item) => {
          const start = minutesFromTime(item.startTime!);
          const end = minutesFromTime(item.endTime) ?? (start != null ? start + 30 : null);
          if (start === null || end === null) return null;
          return { start, end, title: item.title };
        })
        .filter((s): s is { start: number; end: number; title: string } => Boolean(s))
        .sort((a, b) => a.start - b.start);

      // Awake windows (same logic as planMyDay, but no nowMin constraint for future days)
      const sleepStartMin = minutesFromTime(context.sleepStart) ?? 23 * 60;
      const sleepEndMin = minutesFromTime(context.sleepEnd) ?? 6 * 60;
      const nowMin = d === 0 ? (minutesFromTime(context.currentTime) ?? 9 * 60) : sleepEndMin;

      type Window = { start: number; end: number };
      const awakeWindows: Window[] = [];
      if (sleepEndMin <= sleepStartMin) {
        awakeWindows.push({ start: Math.max(sleepEndMin, nowMin), end: sleepStartMin });
      } else {
        if (nowMin < sleepStartMin) awakeWindows.push({ start: nowMin, end: sleepStartMin });
        if (nowMin >= sleepEndMin) awakeWindows.push({ start: nowMin, end: 24 * 60 });
        else awakeWindows.push({ start: sleepEndMin, end: 24 * 60 });
      }

      // Free slots
      const buffer = context.bufferMinutes ?? 0;
      const freeSlots: Array<{ start: number; end: number }> = [];
      for (const window of awakeWindows) {
        let cursor = window.start;
        for (const busy of busySlots) {
          if (busy.start >= window.end) break;
          if (busy.end <= window.start) continue;
          if (busy.start > cursor) freeSlots.push({ start: cursor, end: busy.start });
          cursor = Math.max(cursor, busy.end + buffer);
        }
        if (cursor < window.end) freeSlots.push({ start: cursor, end: window.end });
      }

      // Candidates: unscheduled + overdue, not already scheduled this week
      const candidates = context.items.filter((item) => {
        if (scheduledItems.has(item.id)) return false;
        if (item.status === "completed" || item.status === "cancelled" || item.status === "skipped") return false;
        if (isRecurring(item)) return false; // recurring items stay on their dates
        if (item.startDate && item.hasTime && item.startDate !== today) return false; // already scheduled on another day
        if (item.startDate && item.hasTime && item.startDate === today && d > 0) return false;
        return true;
      });

      // Score and sort (simplified version of planMyDay scoring)
      const scored = candidates
        .map((item) => {
          const priorityScores: Record<string, number> = { urgent: 40, high: 30, medium: 20, low: 10 };
          const priorityScore = priorityScores[item.priority ?? ""] ?? 5;
          let dueDateScore = 0;
          const dueDate = item.dueDate || item.startDate;
          if (dueDate) {
            const due = new Date(dueDate + "T12:00:00");
            const dateD = new Date(dateStr + "T12:00:00");
            const daysUntil = Math.floor((due.getTime() - dateD.getTime()) / 86400000);
            if (daysUntil < 0) dueDateScore = 40;
            else if (daysUntil === 0) dueDateScore = 35;
            else dueDateScore = Math.max(0, 40 - daysUntil * 5);
          }
          return { item, score: priorityScore + dueDateScore };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxItemsPerDay);

      // Assign to free slots
      const usedSlotTime = new Map<number, number>();
      const dayUpdates: Array<{
        targetItemId: string;
        before: ItemFormState;
        after: ItemFormState;
      }> = [];

      for (const candidate of scored) {
        const duration = parseInt(candidate.item.estimateMinutes || "") || 30;
        let assigned = false;
        for (let si = 0; si < freeSlots.length; si++) {
          const slot = freeSlots[si];
          const cursor = usedSlotTime.get(si) ?? slot.start;
          if (cursor + duration <= slot.end) {
            const target = findItem(context, candidate.item.id);
            if (!target) continue;
            const before = formFromAiItem(target);
            const startTime = timeFromMinutes(cursor);
            const endTime = timeFromMinutes(cursor + duration);
            const after = mergeAiFormPatch(before, {
              startDate: dateStr,
              startTime,
              endDate: dateStr,
              endTime,
              hasTime: true,
            });
            dayUpdates.push({ targetItemId: candidate.item.id, before, after });
            usedSlotTime.set(si, cursor + duration + buffer);
            scheduledItems.add(candidate.item.id);
            assigned = true;
            break;
          }
        }
      }

      if (dayUpdates.length > 0) {
        proposedActions.push({
          id: makeActionId("week"),
          type: "schedule_items",
          title: `${dateStr}: ${dayUpdates.length} task(s)`,
          updates: dayUpdates.map((u) => ({
            ...u,
            conflicts: detectAiConflicts(u.after, context.items, [u.targetItemId], context.timezone),
            suggestions: [] as AiActionScheduleSuggestion[],
          })),
          reason,
        });
      }
    }

    if (proposedActions.length === 0) {
      return { message: "No tasks to schedule this week.", proposedActions: [] };
    }

    const totalScheduled = proposedActions.reduce((sum, a) => sum + (a.type === "schedule_items" ? a.updates.length : 0), 0);
    return {
      message: `Planned ${totalScheduled} task(s) across ${proposedActions.length} day(s).`,
      proposedActions,
    };
  },
}),
```

**Step 2: 更新 system prompt**

在 system prompt 中增加：

```
Use planMyWeek when the user asks to plan their week or multiple days. Use planMyDay for a single day.
```

**Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

**Step 4: Commit**

```bash
git add app/api/ai-chat/route.ts
git commit -m "feat: add planMyWeek AI tool for multi-day scheduling"
```

---

### Task 3: 主动建议（AI 面板打开时自动提示异常）

用户打开 AI 面板时，自动检测异常情况并显示提示，无需用户先提问。

**Files:**
- Modify: `lib/hooks/use-ai-chat.ts` — 面板展开时生成主动建议
- Modify: `app/api/ai-chat/route.ts` — 添加 getProactiveHints tool（或直接在客户端计算）

**Step 1: 在 useAiChat 中添加主动建议逻辑**

在 `lib/hooks/use-ai-chat.ts` 中添加主动建议生成函数。这是纯客户端计算，不需要 AI 调用：

```typescript
const [proactiveHints, setProactiveHints] = useState<string[]>([]);

// 生成主动建议（纯客户端计算，零 AI 成本）
useEffect(() => {
  if (!isExpanded || aiMessages.length > 0 || aiLoading) {
    setProactiveHints([]);
    return;
  }

  const hints: string[] = [];
  const today = dayjs().tz(typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Shanghai").format("YYYY-MM-DD");

  // 1. 高优先级逾期任务
  const overdueHigh = candidateItems.filter((item) => {
    if (item.status === "completed" || item.status === "cancelled" || item.status === "skipped") return false;
    if (!item.startDate && !item.dueDate) return false;
    const dateStr = item.dueDate || item.startDate;
    return dateStr && dateStr < today && (item.priority === "urgent" || item.priority === "high");
  });
  if (overdueHigh.length > 0) {
    hints.push(t("ai.hintOverdueHigh", { count: overdueHigh.length }));
  }

  // 2. 今天到期但未排时间
  const dueTodayUnscheduled = candidateItems.filter((item) => {
    if (item.status === "completed" || item.status === "cancelled" || item.status === "skipped") return false;
    if (item.hasTime) return false;
    const dateStr = item.dueDate || item.startDate;
    return dateStr === today;
  });
  if (dueTodayUnscheduled.length >= 3) {
    hints.push(t("ai.hintDueTodayUnscheduled", { count: dueTodayUnscheduled.length }));
  }

  // 3. 今天已排满（空闲时间 < 30 分钟）
  const todayTimed = candidateItems.filter((item) => {
    if (item.status === "completed" || item.status === "cancelled") return false;
    return item.startDate === today && item.hasTime;
  });
  if (todayTimed.length >= 5) {
    hints.push(t("ai.hintPackedDay", { count: todayTimed.length }));
  }

  setProactiveHints(hints.slice(0, 3));
}, [isExpanded, aiMessages.length, aiLoading, candidateItems, t]);
```

**Step 2: 在 AI 面板 UI 中显示提示**

在 `components/ai/ai-overlay.tsx` 中，当 `proactiveHints` 非空且没有对话消息时，显示提示卡片。每个提示是一个可点击的快捷操作，点击后自动发送对应消息给 AI。

**Step 3: 添加 i18n 翻译键**

在 `lib/i18n/dictionary.ts` 中添加：

```typescript
"ai.hintOverdueHigh": "You have {count} high-priority overdue task(s). Want me to reschedule them?",
"ai.hintDueTodayUnscheduled": "{count} tasks due today have no time slot. Want me to plan your day?",
"ai.hintPackedDay": "You have {count} scheduled tasks today. Need help optimizing?",
```

中文：
```typescript
"ai.hintOverdueHigh": "你有 {count} 个高优先级逾期任务，需要重新安排吗？",
"ai.hintDueTodayUnscheduled": "今天有 {count} 个任务没有安排时间，要我帮你规划吗？",
"ai.hintPackedDay": "今天有 {count} 个已排程任务，需要优化安排吗？",
```

**Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

**Step 5: Commit**

```bash
git add lib/hooks/use-ai-chat.ts components/ai/ai-overlay.tsx lib/i18n/dictionary.ts
git commit -m "feat: add proactive hints when AI panel opens"
```

---

### Task 5: 时间估算建议

基于 focus session 历史数据，为任务推荐时间估算。

**Files:**
- Modify: `app/api/ai-chat/route.ts` — 添加 estimateTaskDuration tool
- Modify: `lib/ai/chat-types.ts` — AiChatContext 增加 focusSessions

**Step 1: AiChatContext 增加 focusSessions**

在 `lib/ai/chat-types.ts` 的 `AiChatContext` 中增加：

```typescript
focusSessions: Array<{ itemId?: string; taskTitle?: string; durationSeconds: number; tags?: string[] }>;
```

**Step 2: 客户端传入 focusSessions**

在 `lib/hooks/use-ai-chat.ts` 的 `buildAiChatContext` 中增加：

```typescript
focusSessions: focusSessions.map((s) => ({
  itemId: s.itemId,
  taskTitle: s.taskTitle,
  durationSeconds: s.durationSeconds,
  tags: s.tags,
})),
```

**Step 3: 添加 estimateTaskDuration tool**

在 `buildTools` 中添加：

```typescript
estimateTaskDuration: tool({
  description: "Estimate how long a task might take based on the user's focus session history. Use when the user asks about time estimates, or when creating tasks without a duration.",
  inputSchema: z.object({
    taskTitle: z.string().describe("The task title to estimate duration for."),
    tags: z.array(z.string()).optional().describe("Tags associated with the task."),
  }),
  execute: async ({ taskTitle, tags }): Promise<AiToolResult> => {
    const sessions = context.focusSessions ?? [];
    if (sessions.length === 0) {
      return { message: "No focus session history available for estimation." };
    }

    // 1. Match by exact task title (via taskTitle field)
    const exactMatches = sessions.filter((s) =>
      s.taskTitle && s.taskTitle.toLowerCase() === taskTitle.toLowerCase()
    );

    // 2. Match by overlapping tags
    const tagMatches = tags && tags.length > 0
      ? sessions.filter((s) =>
          s.tags && s.tags.some((t) => tags.some((ut) => t.toLowerCase() === ut.toLowerCase()))
        )
      : [];

    // 3. Match by partial title similarity
    const titleWords = taskTitle.toLowerCase().split(/\s+/);
    const partialMatches = sessions.filter((s) => {
      if (!s.taskTitle) return false;
      const sessionWords = s.taskTitle.toLowerCase().split(/\s+/);
      return titleWords.some((w) => w.length > 3 && sessionWords.some((sw) => sw.includes(w)));
    });

    const relevantSessions = exactMatches.length > 0
      ? exactMatches
      : tagMatches.length > 0
        ? tagMatches
        : partialMatches;

    if (relevantSessions.length === 0) {
      // Fallback: average of all sessions
      const avgMinutes = Math.round(
        sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / sessions.length / 60
      );
      return {
        message: `No similar tasks found. Your average focus session is ${avgMinutes} minutes. Consider using that as a starting estimate.`,
      };
    }

    const durations = relevantSessions.map((s) => s.durationSeconds / 60);
    const avgMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const medianMinutes = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];

    return {
      message: `Based on ${relevantSessions.length} similar session(s), estimated duration: ~${avgMinutes} min (median: ${medianMinutes} min).`,
    };
  },
}),
```

**Step 4: 更新 system prompt**

```
When creating tasks, if the user doesn't specify a duration, you can use estimateTaskDuration to suggest one based on their focus history.
```

**Step 5: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

**Step 6: Commit**

```bash
git add lib/ai/chat-types.ts lib/hooks/use-ai-chat.ts app/api/ai-chat/route.ts
git commit -m "feat: add estimateTaskDuration AI tool based on focus session history"
```

---

### Task 6: 批量完成/跳过

简化"把今天的都标完成"等常见操作。

**Files:**
- Modify: `app/api/ai-chat/route.ts` — 添加 proposeBatchComplete tool

**Step 1: 添加 proposeBatchComplete tool**

在 `buildTools` 中添加。复用 Task 1 的 status 字段：

```typescript
proposeBatchComplete: tool({
  description: "Mark multiple tasks as completed at once. Use when the user says 'mark all done', 'complete these tasks', 'finish the rest', etc. For recurring tasks, this completes the series — use with caution.",
  inputSchema: z.object({
    targetItemIds: z.array(z.string()).optional().describe("Specific item IDs. If omitted, applies to all incomplete tasks from today."),
    reason: z.string().optional(),
  }),
  execute: async ({ targetItemIds, reason }): Promise<AiToolResult> => {
    let itemsToComplete: AiChatItemContext[];

    if (targetItemIds && targetItemIds.length > 0) {
      itemsToComplete = targetItemIds
        .map((id) => context.items.find((item) => item.id === id))
        .filter((item): item is AiChatItemContext => Boolean(item))
        .filter((item) => item.status !== "completed");
    } else {
      const today = context.today;
      itemsToComplete = context.items.filter((item) => {
        if (item.status === "completed") return false;
        if (isRecurring(item)) return false; // don't batch-complete recurring series
        if (item.startDate === today || (item.hasDueDate && item.dueDate === today)) return true;
        return false;
      });
    }

    if (itemsToComplete.length === 0) {
      return { message: "No incomplete tasks found to complete.", proposedActions: [] };
    }

    const updates = itemsToComplete.map((item) => {
      const before = formFromAiItem(item);
      const after = { ...before, status: "completed" as const };
      return {
        targetItemId: item.id,
        patch: { status: "completed" as const },
        before,
        after,
      };
    });

    const proposedActions: AiProposedAction[] = [{
      id: makeActionId("batch-complete"),
      type: "batch_update",
      title: `Complete ${updates.length} task(s)`,
      updates,
      reason,
    }];

    return {
      message: `Prepared to complete ${updates.length} task(s).`,
      proposedActions,
    };
  },
}),
```

**Step 2: 更新 system prompt**

```
Use proposeBatchComplete when the user wants to mark multiple tasks as done at once. For a single task status change, use proposeStatusChange.
```

**Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

**Step 4: Commit**

```bash
git add app/api/ai-chat/route.ts
git commit -m "feat: add proposeBatchComplete AI tool for bulk status changes"
```

---

## 依赖关系

```
Task 1 (status 字段) ──→ Task 6 (批量完成，依赖 status 字段)
Task 2 (周排程) ── 独立
Task 3 (主动建议) ── 独立
Task 5 (时间估算) ── 独立
```

建议实施顺序：Task 1 → Task 6 → Task 2 → Task 5 → Task 3
