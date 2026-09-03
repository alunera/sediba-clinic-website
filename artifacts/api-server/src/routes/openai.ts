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

const SEDI_SERVICE_CATALOG = [
  ["Skin", "The Glow", "Radiance · Hydration · Refresh", "From R1,000"],
  ["Skin", "The Clarify", "Congestion · Breakouts · Balance", "From R1,000"],
  ["Skin", "The Brighten", "Pigmentation · Tone · Luminosity", "From R1,000"],
  ["Skin", "The Firm", "Fine Lines · Firmness · Collagen", "From R1,000"],
  ["Skin", "The Calm", "Sensitivity · Redness · Barrier Support", "From R1,000"],
  ["Skin", "The Renew", "Resurfacing · Texture · Skin Renewal", "From R1,000"],
  ["Skin", "The Lift", "Firming · Definition · Rejuvenation", "From R1,000"],
  ["Skin", "The Repair", "Regeneration · Recovery · Skin Restoration", "From R1,000"],
  ["Advanced Aesthetics", "The Precision Peel", "Targeted Resurfacing · Pigmentation · Texture", "From R1,250"],
  ["Advanced Aesthetics", "The Collagen Boost", "Microneedling · Texture · Fine Lines", "From R990"],
  ["Advanced Aesthetics", "The Regeneration (Exosome)", "Exosome Therapy · Repair · Rejuvenation", "From R2,500"],
  ["Advanced Aesthetics", "The Perfect Polish", "Dermaplaning · Smoothness · Radiance", "From R850"],
  ["Advanced Aesthetics", "The Light Therapy", "LED · Calm · Repair", "R1,750"],
  ["Advanced Aesthetics", "The Smooth", "Laser Hair Removal · All Skin Types", "From R450"],
  ["Advanced Aesthetics", "The Clear", "Laser Tattoo Removal", "From R450"],
  ["Advanced Aesthetics", "The Contour", "Cavitation · Body Contouring", "From R550"],
  ["Body & Wellness", "The Sediba Signature", "Full-Body Relaxation · Restore · Rebalance", "R750"],
  ["Body & Wellness", "The Deep Release", "Deep Tissue · Muscle Tension · Recovery", "R500"],
  ["Body & Wellness", "The Reset", "Back · Neck · Shoulders", "R450"],
  ["Body & Wellness", "The Aroma Ritual", "Aromatherapy · Relaxation · Wellbeing", "R800"],
  ["Body & Wellness", "Add-On Massage", "Hand or Foot Massage (Add-On)", "R350"],
  ["Hands & Feet", "The Manicure", "Shape · Cuticle Care · Polish", "R350"],
  ["Hands & Feet", "The Gel Manicure", "Long-Wear · High Shine", "R400"],
  ["Hands & Feet", "The Pedicure", "Foot Care · Shape · Polish", "R420"],
  ["Hands & Feet", "The Gel Pedicure", "Long-Wear · High Shine", "R620"],
  ["Hands & Feet", "The Luxury Hand Ritual", "Exfoliate · Nourish · Massage", "R350"],
  ["Hands & Feet", "The Luxury Foot Ritual", "Exfoliate · Restore · Massage", "R350"],
  ["Consultation", "Consultation", "Personalised 30-minute skin and wellness consultation", "R350"],
] as const;

export function formatServiceCatalog(): string {
  const lines = SEDI_SERVICE_CATALOG.map(
    ([category, name, description, price]) => `• ${name} | ${category} | ${price} | ${description}`,
  );
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

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: formatServiceCatalog() },
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
