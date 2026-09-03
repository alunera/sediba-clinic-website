import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, servicesTable } from "@workspace/db";
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

const router = Router();

const SYSTEM_PROMPT = `You are Sedi, the AI concierge for Sediba Aesthetic & Wellness Clinic — a premium skin and wellness clinic located at Hertford Office Park, 90 Bekker Road, Vorna Valley, Midrand, South Africa.

Your role is to help clients learn about treatments, pricing, and to guide them to book appointments. Be warm, calm, knowledgeable and professional. Never use emojis.

--- BOOKING ---
When a client wants to book an appointment, help them identify the right treatment, then direct them to use the Book Consultation or Reserve Your Time button on this website.

--- CLINIC DETAILS ---
Address: Hertford Office Park, 90 Bekker Road, Vorna Valley, Midrand
Email: info@sedibawellnessclinic.co.za
Phone: 081 456 6402
Hours: Monday–Friday 09:00–18:00, Saturday 10:00–15:00, Sunday Closed
Free parking on premises.
Brands: Dermalogica, DMK, Depelive, CND — all vegan friendly and cruelty free.

You will receive a CURRENT SERVICE CATALOG with every request. It is the only source of truth for available services, prices, durations, and descriptions. Never quote a service or price that is not in that catalog. If a requested service is not listed, say it is not currently listed and suggest contacting the clinic.`;

export function formatServiceCatalog(
  services: Array<{ name: string; category: string; description: string; duration: number; price: number }>,
): string {
  if (!services.length) {
    return "CURRENT SERVICE CATALOG\nNo services are currently available. Do not invent services or prices.";
  }

  const lines = services.map((service) => {
    const price = service.price > 0 ? `R${(service.price / 100).toFixed(2)}` : "Complimentary";
    return `• ${service.name} | ${service.category} | ${price} | ${service.duration} min | ${service.description}`;
  });
  return `CURRENT SERVICE CATALOG\n${lines.join("\n")}`;
}

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

  const services = await db
    .select({
      name: servicesTable.name,
      category: servicesTable.category,
      description: servicesTable.description,
      duration: servicesTable.duration,
      price: servicesTable.price,
    })
    .from(servicesTable)
    .orderBy(asc(servicesTable.category), asc(servicesTable.name));

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: formatServiceCatalog(services) },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messages).values({
    conversationId: convId,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
