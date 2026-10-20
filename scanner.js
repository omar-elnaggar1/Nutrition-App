// Reads a nutrition-label photo with Claude. This file runs ONLY on the server,
// so the API key (from .env) is never sent to the phone.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export const MODEL = 'claude-haiku-5-5';
export const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

/** An error with a short code the phone uses to pick a friendly message. */
export class ScanError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

// ---- What we ask Claude to send back ----------------------------------------

const amount = z.number().nullable();

// One column of the label (either "per 100 g" or "per serving"), copied as printed.
const LabelColumn = z.object({
  calories_kcal: amount,
  energy_kj: amount,
  protein_g: amount,
  carbs_g: amount,
  fat_g: amount,
  fiber_g: amount,
  sugar_g: amount,
  sodium_mg: amount,
  salt_g: amount,
});

const LabelReading = z.object({
  photo_status: z.enum(['readable', 'blurry', 'not_a_label']),
  product_name: z.string().nullable(),
  serving_size_g: amount,
  per_100g: LabelColumn.nullable(),
  per_serving: LabelColumn.nullable(),
});

const INSTRUCTIONS = `You read nutrition labels from photos for a food-tracking app.

Set photo_status:
- "not_a_label" if the photo does not show a nutrition facts / nutrition information panel.
- "blurry" if it is a label but the numbers are too blurry, dark, cut off or glared to read reliably.
- "readable" otherwise.

Copy numbers exactly as printed. Never estimate, calculate or guess: if a value is not printed or you cannot read it, use null.
- per_100g: the "per 100 g" (or "per 100 ml") column, if the label has one; otherwise null.
- per_serving: the "per serving" / "per portion" column, if the label has one; otherwise null.
- serving_size_g: the serving size in grams (or ml) if printed; otherwise null.
- Energy: put kcal/Calories in calories_kcal and kJ in energy_kj (fill both if both are printed).
- Sodium: put sodium in milligrams in sodium_mg (convert g to mg by multiplying by 1000). If the label shows salt instead, put it in salt_g.
- carbs_g is total carbohydrate. fiber_g is dietary fibre. sugar_g is total sugars.
- "<0.5 g" or "trace" means 0.
- product_name: the product name if visible in the photo, otherwise null.`;

// ---- Turning Claude's reading into per-100 g numbers --------------------------

const round = (value, decimals = 1) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Picks one nutrient from a label column, converting kJ → kcal and salt → sodium if needed. */
function fromColumn(column, key) {
  if (!column) return null;
  switch (key) {
    case 'calories':
      return column.calories_kcal ?? (column.energy_kj != null ? column.energy_kj / 4.184 : null);
    case 'sodium':
      return column.sodium_mg ?? (column.salt_g != null ? column.salt_g * 400 : null); // salt is 40% sodium
    default:
      return column[`${key}_g`] ?? null;
  }
}

/**
 * Converts Claude's raw reading into the app's format.
 * The per-serving → per-100 g maths is done here in code (not by the AI) so it's exact.
 */
export function normalizeReading(reading) {
  const serving = reading.serving_size_g > 0 ? reading.serving_size_g : null;
  const per100 = {};
  const convertedFromServing = [];

  for (const key of NUTRIENT_KEYS) {
    let value = fromColumn(reading.per_100g, key);
    if (value == null && serving) {
      const perServing = fromColumn(reading.per_serving, key);
      if (perServing != null) {
        value = (perServing * 100) / serving;
        convertedFromServing.push(key);
      }
    }
    per100[key] = value == null || value < 0 ? null : round(value, key === 'sodium' || key === 'calories' ? 0 : 1);
  }

  return {
    productName: reading.product_name?.trim() || null,
    servingSizeG: serving ? round(serving) : null,
    per100,
    missing: NUTRIENT_KEYS.filter((key) => per100[key] == null),
    convertedFromServing,
    blurry: reading.photo_status === 'blurry',
  };
}

// ---- Calling Claude --------------------------------------------------------

let client;
function getClient() {
  // timeout is in milliseconds; one automatic retry on network blips / overload.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
  return client;
}

/** Sends the photo to Claude and returns normalized per-100 g values, or throws a ScanError. */
export async function scanLabelImage({ imageBase64, mediaType }) {
  let response;
  try {
    response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(LabelReading) },
      system: INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Read this nutrition label.' },
          ],
        },
      ],
    });
  } catch (err) {
    throw toScanError(err);
  }

  const reading = response.parsed_output;
  if (response.stop_reason === 'refusal' || !reading) {
    console.error('Label scan: no usable output, stop_reason =', response.stop_reason);
    throw new ScanError('unreadable', 422);
  }
  if (reading.photo_status === 'not_a_label') throw new ScanError('not_label', 422);

  const result = normalizeReading(reading);
  const coreFound = ['calories', 'protein', 'carbs', 'fat'].some((key) => result.per100[key] != null);
  if (!coreFound) throw new ScanError(reading.photo_status === 'blurry' ? 'blurry' : 'unreadable', 422);
  return result;
}

/** Maps Anthropic SDK errors (most specific first) to codes the phone understands. */
function toScanError(err) {
  console.error('Claude API error:', err?.status ?? '', err?.message ?? err);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ScanError('bad_api_key', 500);
  }
  if (err instanceof Anthropic.RateLimitError) return new ScanError('busy', 429);
  if (err instanceof Anthropic.BadRequestError) return new ScanError('api_error', 502);
  if (err instanceof Anthropic.APIConnectionError) return new ScanError('claude_unreachable', 502); // includes timeouts
  if (err instanceof Anthropic.APIError) return new ScanError(err.status >= 500 ? 'busy' : 'api_error', err.status >= 500 ? 503 : 502);
  return new ScanError('unreadable', 422); // Claude's reply didn't match the expected format
}
