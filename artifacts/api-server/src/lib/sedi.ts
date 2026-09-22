import { db, servicesTable } from "@workspace/db";
import {
  ALL_TREATMENTS,
  TREATMENT_MENU,
  findTreatmentByName,
} from "@workspace/treatment-catalog";
import { sql } from "drizzle-orm";
import { getLiveAvailability, type AvailabilitySlot } from "./availability";
import { isServiceBookableForNewAppointment } from "./service-catalog";

export const SEDI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_availability",
      description:
        "Read the existing live booking calendar for one exact date. Use before saying a date or time is available.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Calendar date in YYYY-MM-DD format.",
          },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_booking",
      description:
        "Validate a catalog treatment against the existing booking database and prepare a safe handoff to the existing booking form. This never reserves or confirms an appointment.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          treatment: {
            type: "string",
            enum: ALL_TREATMENTS.map((treatment) => treatment.name),
            description: "Exact CURRENT TREATMENT CATALOG name.",
          },
          date: {
            type: ["string", "null"],
            description: "Optional date in YYYY-MM-DD format.",
          },
          time: {
            type: ["string", "null"],
            description: "Optional 24-hour time in HH:mm format.",
          },
        },
        required: ["treatment", "date", "time"],
        additionalProperties: false,
      },
    },
  },
] as const;

export const SYSTEM_PROMPT = `You are Sedi, Sediba Aesthetic & Wellness Clinic's warm online clinic consultant, treatment recommender and booking assistant. Sound like a calm, knowledgeable team member: conversational, concise, professional, and never pushy. Do not use emojis or generic chatbot phrases.

APPROVED FACTS AND SOURCES
- The CURRENT TREATMENT CATALOG supplied with every request is the sole source for treatment names, categories, descriptions, durations and prices. Never invent or estimate any of them.
- Three services customers ask about most are Microneedling, Chemical Peels and Massages. This is not a broader popularity ranking. Translate these common terms only to relevant treatments actually in the catalog.
- Location: Hertford Office Park, Building M, Waterfall, Midrand. Do not add a street address.
- Hours: Monday-Friday 09:00-18:00; Saturday 10:00-15:00; Sunday closed.
- Phone: 081 456 6402. Email: info@sedibawellnessclinic.co.za.
- A Skin Consultation has its own existing form at /book-consultation. Its current live database details are supplied separately when available.
- Existing booking-form policy: 100% payment is required to secure an appointment; cancellations less than 24 hours before an appointment forfeit the full booking amount; rescheduling requires at least 24 hours' notice; clients should arrive 5 minutes early.
- Do not state parking, product-brand, medical-aid, gift-card, preparation, aftercare, consultation-requirement, downtime, pain, results, or session-count facts unless they are explicitly present in the supplied approved knowledge. Catalog taglines are not clinical guarantees.

CONSULTING AND SAFETY
- Understand the concern, ask one useful follow-up when needed, then suggest only relevant catalog treatments and briefly connect the suggestion to catalog wording. Never call one universally best.
- If the client asks for a recommendation without naming a concern, ask one short question rather than listing options. Once the concern is clear, lead with ONE relevant treatment and explain why using its catalog description; offer at most one alternative only if needed. End with an offer to book the primary recommendation. Do not overwhelm them with a menu. If they next ask "How much?" or say "Okay, book it", continue with that primary recommendation without asking them to repeat it. Clarify only when the conversation genuinely has no primary choice.
- Do not diagnose, guarantee outcomes, promise cures, or give personalised medical advice. For contraindications, reactions, complaints, suitability needing examination, or unsupported facts, say you do not have confirmed information and hand off naturally to the phone/email or offer [Book a consultation](/book-consultation).
- Preserve conversational context. Replies such as "it", "yes", or "let's book it" refer to the relevant treatment from the full conversation when clear. Do not make the client repeat known information.

BOOKING
- For actual booking intent, confirm the catalog treatment, proactively ask for a date, use get_availability, and help choose only a returned available time. If the date is not known, prepare_booking may be called with null date/time so the user can continue in the existing calendar. Once a valid choice is known, call prepare_booking with it.
- prepare_booking never creates, reserves or confirms an appointment. Never claim a reservation or confirmation. Policy acceptance is not confirmation, and payment is only confirmed by the existing booking/payment flow after provider verification. Client details, clinic policy acceptance and any Yoco payment stay in that form.
- Only say a date/time is available after get_availability or successful prepare_booking in this turn. Treat tool errors as unavailable/needs another choice.
- Never write or alter the Continue booking markdown link yourself. The server appends the validated link after prepare_booking.

If an answer is absent from these sources, say you do not have confirmed information and offer a concise human handoff.`;

export function formatClinicDateContext(now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
  }).format(now);
  return `CURRENT CLINIC DATE\nToday is ${weekday}, ${date}, in Africa/Johannesburg. Resolve relative dates such as Friday from this date, then use tools before claiming availability.`;
}

export function formatTreatmentCatalog(): string {
  const lines = TREATMENT_MENU.flatMap((category) =>
    category.treatments.map(
      (treatment) =>
        `• ${treatment.name} | ${category.label} | ${treatment.price} | ${treatment.duration} min | ${treatment.sub}`,
    ),
  );
  return `CURRENT TREATMENT CATALOG\n${lines.join("\n")}`;
}

export async function formatLiveConsultation(): Promise<string> {
  const [consultation] = await db
    .select({
      name: servicesTable.name,
      duration: servicesTable.duration,
      price: servicesTable.price,
    })
    .from(servicesTable)
    .where(sql`lower(${servicesTable.category}) = 'consultation'`)
    .orderBy(servicesTable.id)
    .limit(1);
  if (!consultation) {
    return "CURRENT CONSULTATION DETAILS\nNo live consultation details are available; do not quote a fee or duration.";
  }
  return `CURRENT CONSULTATION DETAILS\n${consultation.name} | R${(consultation.price / 100).toFixed(2)} | ${consultation.duration} min | booking form: /book-consultation`;
}

type BookableTreatment = { id: number; name: string };

async function resolveBookableTreatment(
  treatmentName: string,
): Promise<BookableTreatment | undefined> {
  const catalogTreatment = findTreatmentByName(treatmentName);
  if (!catalogTreatment) return undefined;

  const [service] = await db
    .select({
      id: servicesTable.id,
      name: servicesTable.name,
      category: servicesTable.category,
    })
    .from(servicesTable)
    .where(sql`lower(${servicesTable.name}) = lower(${catalogTreatment.name})`)
    .orderBy(servicesTable.id)
    .limit(1);
  if (
    !service ||
    !isServiceBookableForNewAppointment(service, service.id)
  ) {
    return undefined;
  }
  return { id: service.id, name: catalogTreatment.name };
}

export type SediToolDependencies = {
  availability: (date: string) => Promise<AvailabilitySlot[]>;
  resolveTreatment: (
    treatment: string,
  ) => Promise<BookableTreatment | undefined>;
};

const defaultToolDependencies: SediToolDependencies = {
  availability: getLiveAvailability,
  resolveTreatment: resolveBookableTreatment,
};

function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function validTime(time: unknown): time is string {
  return (
    typeof time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  );
}

export function bookingLink(
  treatment: string,
  date?: string,
  time?: string,
): string {
  const query = [`treatment=${encodeURIComponent(treatment)}`];
  if (date) query.push(`date=${encodeURIComponent(date)}`);
  if (time) query.push(`time=${encodeURIComponent(time)}`);
  return `[Continue booking ${treatment}](/book?${query.join("&")})`;
}

export function appendPreparedBookingLink(
  content: string,
  preparedLink?: string,
): string {
  // Only the server may emit a /book handoff. Preserve /book-consultation,
  // which is the approved human/practitioner handoff.
  const safeContent = content
    .replace(/\[[^\]\n]*\]\(\s*\/book(?!-consultation)(?:[/?#][^)\s]*)?\s*\)/gi, "")
    .trim() || SEDI_FAILURE_HANDOFF;
  return preparedLink ? `${safeContent}\n\n${preparedLink}` : safeContent;
}

export const SEDI_FAILURE_HANDOFF =
  "I couldn't complete that live booking check. Please try again, call 081 456 6402, or email info@sedibawellnessclinic.co.za.";

export async function executeSediTool(
  name: string,
  rawArguments: string,
  dependencies: SediToolDependencies = defaultToolDependencies,
): Promise<{ output: string; preparedLink?: string }> {
  let args: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawArguments);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        output: JSON.stringify({
          ok: false,
          error: "Tool arguments must be a JSON object.",
        }),
      };
    }
    args = parsed as Record<string, unknown>;
  } catch {
    return { output: JSON.stringify({ ok: false, error: "Invalid tool arguments." }) };
  }

  if (name === "get_availability") {
    if (!validDate(args.date)) {
      return { output: JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }) };
    }
    const slots = await dependencies.availability(args.date);
    return {
      output: JSON.stringify({
        ok: true,
        date: args.date,
        availableTimes: slots
          .filter((slot) => slot.available)
          .map((slot) => slot.time),
      }),
    };
  }

  if (name === "prepare_booking") {
    if (typeof args.treatment !== "string") {
      return { output: JSON.stringify({ ok: false, error: "An exact catalog treatment is required." }) };
    }
    const treatment = findTreatmentByName(args.treatment);
    if (!treatment || args.treatment !== treatment.name) {
      return { output: JSON.stringify({ ok: false, error: "Use an exact CURRENT TREATMENT CATALOG name." }) };
    }
    const date = args.date == null ? undefined : args.date;
    const time = args.time == null ? undefined : args.time;
    if (date !== undefined && !validDate(date)) {
      return { output: JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }) };
    }
    if (time !== undefined && !validTime(time)) {
      return { output: JSON.stringify({ ok: false, error: "time must be HH:mm" }) };
    }
    if (time && !date) {
      return { output: JSON.stringify({ ok: false, error: "A date is required when a time is supplied." }) };
    }
    const service = await dependencies.resolveTreatment(treatment.name);
    if (!service) {
      return { output: JSON.stringify({ ok: false, error: "This catalog treatment is not currently bookable." }) };
    }
    if (date) {
      const available = (await dependencies.availability(date))
        .filter((slot) => slot.available)
        .map((slot) => slot.time);
      if (available.length === 0) {
        return { output: JSON.stringify({ ok: false, error: "That date has no live availability." }) };
      }
      if (time && !available.includes(time)) {
        return { output: JSON.stringify({ ok: false, error: "That time is not currently available." }) };
      }
    }
    const preparedLink = bookingLink(treatment.name, date, time);
    return {
      output: JSON.stringify({
        ok: true,
        treatment: treatment.name,
        date: date ?? null,
        time: time ?? null,
        message: "Booking handoff prepared. No appointment has been reserved or confirmed.",
      }),
      preparedLink,
    };
  }

  return { output: JSON.stringify({ ok: false, error: "Unknown tool." }) };
}