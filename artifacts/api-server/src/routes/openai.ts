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

const SYSTEM_PROMPT = `You are Sedi, the AI concierge for Sediba Aesthetic & Wellness Clinic — a premium skin, nail, massage and grooming clinic located at Hertford Office Park, 90 Bekker Road, Vorna Valley, Midrand, South Africa.

Your role is to help clients learn about treatments, pricing, and to guide them to book appointments. Be warm, calm, knowledgeable and professional. Never use emojis.

--- FULL TREATMENT MENU ---

SKIN TREATMENTS — DMK ENZYME THERAPY
• Alkaline Wash & Enzyme Mask — R1200 — 75 min — Deep-cleansing alkaline wash with the signature enzyme mask for skin detoxification and renewal.
• Bihaku — R1150 — 75 min — Brightening enzyme treatment targeting pigmentation, dark spots and uneven skin tone.
• Hydradermaze — R1100 — 75 min — DMK's signature hydration and enzyme treatment that floods the skin with moisture.
• Pro Alpha Six Layer Peel — R1400 — 90 min — Advanced six-layer chemical peel for dramatic skin resurfacing and renewal.
• Retouch — R900 — 60 min — A targeted DMK treatment designed to refine and retouch specific skin concerns.
• Muscle Banding — R1250 — 75 min — A specialised DMK technique that tightens and tones facial muscles for a lifted appearance.

SKIN TREATMENTS — DERMALOGICA
• Skin Analysis & Consultation — Complimentary — 30 min — Comprehensive skin analysis using Face Mapping to identify your unique skin concerns.
• Pro Skin 30 — R550 — 30 min — An express professional facial customised for your skin type and concerns.
• Pro Skin 60 — R900 — 60 min — A full professional facial with double cleanse, exfoliation and customised masque.
• Pro Skin 90 — R1200 — 90 min — An extended facial experience including advanced treatments tailored to your skin.
• Age Smart Facial — R1050 — 60 min — Anti-ageing facial using Dermalogica's Age Smart line to firm, lift and hydrate.
• BioLumin-C Brightening Facial — R1000 — 60 min — Vitamin C-powered brightening facial that targets dullness and uneven tone.

NAIL TREATMENTS
• Classic Manicure — R250 — 45 min — Traditional manicure including nail shaping, cuticle care and hand massage.
• Classic Pedicure — R300 — 60 min — Classic pedicure with foot soak, exfoliation, nail care and foot massage.
• Spa Manicure — R380 — 60 min — Luxurious manicure with exfoliation, mask and extended massage.
• Spa Pedicure — R450 — 75 min — Indulgent pedicure with foot soak, scrub, mask and extended massage.
• Gel Manicure — R380 — 60 min — Long-lasting gel polish manicure with curing.
• Gel Pedicure — R430 — 75 min — Long-lasting gel polish pedicure.
• Gel Removal — R150 — 20 min — Safe, professional gel polish removal.
• Acrylic Full Set — R550 — 90 min — Full set of acrylic nail extensions.
• Acrylic Infill — R350 — 60 min — Infill for existing acrylic nails.
• Acrylic Removal — R180 — 30 min — Professional acrylic nail removal.
• Nail Art (per nail) — R30 — varies — Custom nail art design per nail.
• French Polish — R120 — 15 min — Classic French polish overlay.
• Polish Change (Hands) — R100 — 15 min — Nail polish colour change for hands.
• Polish Change (Feet) — R120 — 15 min — Nail polish colour change for feet.
• Paraffin Wax Treatment (Hands) — R180 — 20 min — Deeply moisturising paraffin wax treatment for hands.
• Paraffin Wax Treatment (Feet) — R200 — 20 min — Deeply moisturising paraffin wax treatment for feet.

GROOMING
• Eyebrow Shape & Tint — R250 — 30 min — Professional eyebrow shaping and tinting service.
• Eyelash Tint — R200 — 20 min — Eyelash tinting for definition and depth.
• Eyebrow & Lash Tint Combo — R380 — 45 min — Combined eyebrow and eyelash tinting.
• Eyebrow Threading — R120 — 15 min — Precise eyebrow shaping using threading technique.
• Dermaplaning — R500 — 45 min — Exfoliating treatment that removes dead skin cells and vellus hair.
• Mini Facial with Dermaplaning — R750 — 60 min — Express facial combined with dermaplaning for a smooth, glowing result.

MASSAGES
• Swedish Relaxation Massage (60 min) — R600 — Full-body relaxation massage using long gliding strokes.
• Swedish Relaxation Massage (90 min) — R850 — Extended full-body relaxation massage.
• Deep Tissue Massage (60 min) — R700 — Firm-pressure massage targeting deep muscle layers and tension.
• Deep Tissue Massage (90 min) — R950 — Extended deep tissue massage.
• Hot Stone Massage (60 min) — R750 — Relaxing massage using heated basalt stones.
• Hot Stone Massage (90 min) — R1000 — Extended hot stone massage experience.
• Aromatherapy Massage (60 min) — R650 — Massage with essential oils chosen for your wellbeing needs.
• Aromatherapy Massage (90 min) — R900 — Extended aromatherapy massage.
• Couples Massage (60 min) — R1100 per couple — Side-by-side relaxation massage for two.
• Prenatal Massage (60 min) — R650 — Gentle, supportive massage designed for expectant mothers.

WAXING — WOMEN
• Eyebrow Wax — R100 — Upper Lip Wax — R80 — Chin Wax — R80 — Full Face Wax — R280
• Underarm Wax — R150 — Half Arm Wax — R200 — Full Arm Wax — R280
• Half Leg Wax — R280 — Full Leg Wax — R450 — Full Leg & Bikini — R600
• Standard Bikini Wax — R250 — Extended Bikini Wax — R320 — Brazilian Wax — R450 — Hollywood Wax — R500
• Stomach Wax — R200 — Back Wax — R350 — Full Body Wax — R1200

WAXING — MEN
• Eyebrow Wax — R120 — Ear Wax — R100 — Nose Wax — R100 — Back Wax — R400 — Chest Wax — R350 — Full Body Wax — R1400

--- BOOKING ---
When a client wants to book an appointment, help them identify the right treatment, then direct them to complete their booking online at:
https://sediba-wellness-clinic.salonbridge.website/

You can say: "To secure your appointment, please visit our booking page at https://sediba-wellness-clinic.salonbridge.website/ where you can choose your treatment, therapist, preferred date and time."

--- CLINIC DETAILS ---
Address: Hertford Office Park, 90 Bekker Road, Vorna Valley, Midrand
Email: info@sedibawellnessclinic.co.za
Phone: 081 456 6402
Hours: Monday–Friday 09:00–18:00, Saturday 10:00–15:00, Sunday Closed
Free parking on premises.
Brands: Dermalogica, DMK, Depelive, CND — all vegan friendly and cruelty free.`;

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
