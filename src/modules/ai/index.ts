import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export async function callLLM(prompt: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set, returning stub response.');
    return 'Stubbed AI response. Provide OPENAI_API_KEY to enable real calls.';
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
      }
    );

    return response.data.choices?.[0]?.message?.content ?? '';
  } catch (error) {
    logger.error('LLM call failed', error);
    return 'LLM call failed';
  }
}

export function propertyScorePrompt(data: {
  address: string;
  city: string;
  state: string;
  zip: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  equityEstimate?: number | null;
  ownerName?: string | null;
}): string {
  return `You are a real estate acquisitions analyst. Given the property data, estimate ARV and motivation.
Return JSON with keys arvEstimate (number), motivationScore (0-100), explanation (short).
Property: ${data.address}, ${data.city}, ${data.state} ${data.zip}.
Details: beds=${data.beds ?? 'n/a'}, baths=${data.baths ?? 'n/a'}, sqft=${data.sqft ?? 'n/a'}, equity=${data.equityEstimate ?? 'n/a'}.
Owner: ${data.ownerName ?? 'unknown'}.`;
}

export function acquisitionsScriptPrompt(data: {
  ownerName?: string | null;
  address: string;
  equityEstimate?: number | null;
}): string {
  return `Create a concise cold outreach SMS and a phone call script for a real estate acquisitions rep.
Return JSON with keys sms and callScript.
Owner: ${data.ownerName ?? 'there'}. Property: ${data.address}. Equity estimate: ${data.equityEstimate ?? 'unknown'}%. Keep it friendly and compliant.`;
}

export function leadClassificationPrompt(transcript: string): string {
  return `You are classifying a seller call summary. Response options: NOT_INTERESTED, QUALIFIED_WARM, QUALIFIED_HOT.
Transcript: ${transcript}. Provide JSON {status, motivationScore (0-100)} and a one line note.`;
}

export function buyerSummaryPrompt(buyer: {
  name: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  targetZips: string[];
  strategy?: string | null;
  maxRehabLevel?: string | null;
}): string {
  return `Summarize this cash buyer's buy box in 1-2 sentences.
Name: ${buyer.name}
Price: ${buyer.minPrice ?? 'any'}-${buyer.maxPrice ?? 'any'}
Zips: ${buyer.targetZips.join(', ')}
Strategy: ${buyer.strategy ?? 'any'}
Rehab: ${buyer.maxRehabLevel ?? 'any'}
Respond with a short paragraph.`;
}

export function dealMarketingPrompt(deal: {
  address: string;
  city: string;
  state: string;
  zip: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  contractPrice: number;
  arv?: number | null;
  estimatedRepairs?: number | null;
}): string {
  return `Write a concise marketing blurb (2-3 sentences) and an SMS line for an off-market investment deal.
Return JSON {emailBlurb, smsLine}.
Property: ${deal.address}, ${deal.city}, ${deal.state} ${deal.zip}
Details: beds=${deal.beds ?? 'n/a'}, baths=${deal.baths ?? 'n/a'}, sqft=${deal.sqft ?? 'n/a'}
Numbers: price=$${deal.contractPrice}, arv=${deal.arv ?? 'n/a'}, repairs=${deal.estimatedRepairs ?? 'n/a'}.`;
}

export function buyerResponsePrompt(message: string): string {
  return `Classify this buyer SMS reply as interested, pass, or question. Reply with JSON {classification}.
Message: ${message}`;
}
