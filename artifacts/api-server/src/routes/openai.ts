import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import {
  SYSTEM_PROMPT,
  SEDI_TOOLS,
  appendPreparedBookingLink,
  executeSediTool,
  formatClinicDateContext,
  formatLiveConsultation,
  formatTreatmentCatalog,
} from "../lib/sedi";

const router = Router();

router.get("/openai/conversations", async (_req, res) => {
  const all = await db.select().from(conversations).orderBy(conversations.createdAt);
  res.json(all);
});

router.post("/openai/conversations", async (req, res) => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();

  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", async (req, res) => {
  const parsed = GetOpenaiConversationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, parsed.data.id));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsed.data.id))
    .orderBy(asc(messages.createdAt));

  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const parsed = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db.delete(messages).where(eq(messages.conversationId, parsed.data.id));
  await db.delete(conversations).where(eq(conversations.id, parsed.data.id));

  res.status(204).send();
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const parsed = ListOpenaiMessagesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsed.data.id))
    .orderBy(asc(messages.createdAt));

  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const paramsParsed = SendOpenaiMessageParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const convId = paramsParsed.data.id;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, convId));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: convId,
    role: "user",
    content: bodyParsed.data.content,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(asc(messages.createdAt));

  type CompletionParams = Parameters<
    typeof openai.chat.completions.create
  >[0];
  const chatMessages: CompletionParams["messages"] = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: formatClinicDateContext() },
    { role: "system" as const, content: formatTreatmentCatalog() },
    { role: "system" as const, content: await formatLiveConsultation() },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  let preparedLink: string | undefined;

  try {
    // Keep tool use bounded so a malformed model/tool exchange cannot hold an
    // SSE request open indefinitely.
    for (let round = 0; round < 4; round++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 8192,
        messages: chatMessages,
        tools: [...SEDI_TOOLS],
      });
      const assistant = completion.choices[0]?.message;
      if (!assistant) throw new Error("OpenAI returned no assistant message");

      const toolCalls = assistant.tool_calls ?? [];
      if (toolCalls.length === 0) {
        fullResponse = assistant.content ?? "";
        break;
      }

      chatMessages.push({
        role: "assistant" as const,
        content: assistant.content,
        tool_calls: toolCalls,
      });
      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        let result;
        try {
          result = await executeSediTool(
            toolCall.function.name,
            toolCall.function.arguments,
          );
        } catch {
          result = {
            output: JSON.stringify({
              ok: false,
              error: "Live booking information could not be checked.",
            }),
          };
        }
        if (result.preparedLink) preparedLink = result.preparedLink;
        chatMessages.push({
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: result.output,
        });
      }
    }

    fullResponse = appendPreparedBookingLink(fullResponse, preparedLink);
  } catch {
    fullResponse =
      "I'm sorry, I couldn't complete that request just now. Please try again, call 081 456 6402, or email info@sedibawellnessclinic.co.za.";
  }

  await db.insert(messages).values({
    conversationId: convId,
    role: "assistant",
    content: fullResponse,
  });
  res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
