import { parse } from 'csv-parse/sync';
import { CallDirection, LeadStatus, PropertyStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { acquisitionsScriptPrompt, callLLM, leadClassificationPrompt, propertyScorePrompt } from '../ai';
import { logger } from '../../config/logger';
import { sendSms } from '../twilio';

export async function importPropstreamCsv(buffer: Buffer) {
  const rows: any[] = parse(buffer, { columns: true, skip_empty_lines: true });
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const address = row['Property Address']?.trim();
      if (!address) {
        skipped++;
        continue;
      }
      const ownerName = row['Owner Name']?.trim() || null;
      const city = row['City']?.trim() || '';
      const state = row['State']?.trim() || '';
      const zip = row['Zip']?.trim() || '';

      const existing = await prisma.property.findUnique({
        where: { address_ownerName: { address, ownerName } },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const firstPhone = row['Phone'] || row['Phone 1'] || row['Phone 2'] || null;
      await prisma.property.create({
        data: {
          address,
          city,
          state,
          zip,
          propstreamId: row['ID'] || null,
          ownerName,
          ownerMailingAddr: row['Mailing Address'] || null,
          ownerPhoneRaw: firstPhone,
          equityEstimate: row['Equity %'] ? parseFloat(row['Equity %']) : null,
          leads: {
            create: {
              ownerName,
              phone: firstPhone || 'unknown',
              source: 'PropStream',
              lastStatus: LeadStatus.NEW,
            },
          },
        },
      });
      imported++;
    } catch (error: any) {
      logger.error('Error importing row', error);
      errors.push(error.message ?? 'unknown error');
    }
  }

  return { imported, skipped, errors };
}

export async function scorePropertyAndLead(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { leads: true } });
  if (!property) throw new Error('Property not found');

  const prompt = propertyScorePrompt({
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    equityEstimate: property.equityEstimate,
    ownerName: property.ownerName,
  });

  const response = await callLLM(prompt);
  let arvEstimate: number | null = null;
  let motivationScore: number | null = null;
  try {
    const parsed = JSON.parse(response);
    arvEstimate = parsed.arvEstimate ? Number(parsed.arvEstimate) : null;
    motivationScore = parsed.motivationScore ? Number(parsed.motivationScore) : null;
  } catch {
    logger.warn('LLM did not return JSON, using defaults');
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      arvEstimate,
      motivationScore,
    },
  });

  if (property.leads[0]) {
    await prisma.lead.update({
      where: { id: property.leads[0].id },
      data: { motivationScore },
    });
  }

  return { arvEstimate, motivationScore };
}

export async function batchScoreNewProperties() {
  const properties = await prisma.property.findMany({ where: { status: PropertyStatus.NEW } });
  for (const property of properties) {
    await scorePropertyAndLead(property.id);
  }
}

export async function contactLead(leadId: string, options: { sendSms: boolean }) {
  const lead = await prisma.lead.findUnique({ include: { property: true }, where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const prompt = acquisitionsScriptPrompt({
    ownerName: lead.ownerName,
    address: `${lead.property.address}, ${lead.property.city}, ${lead.property.state} ${lead.property.zip}`,
    equityEstimate: lead.property.equityEstimate,
  });
  const response = await callLLM(prompt);
  let sms = 'Hi, this is Sell Hut Properties.';
  let callScript = 'Intro + rapport + gauge motivation.';
  try {
    const parsed = JSON.parse(response);
    sms = parsed.sms ?? sms;
    callScript = parsed.callScript ?? callScript;
  } catch {
    logger.warn('LLM did not return JSON for scripts');
  }

  if (options.sendSms && lead.phone) {
    await sendSms(lead.phone, sms);
  }

  const callAttempt = await prisma.callAttempt.create({
    data: {
      leadId,
      direction: CallDirection.OUTBOUND,
      result: 'script generated',
      aiSummary: callScript,
    },
  });

  await classifyLeadFromTranscript(leadId, callScript);

  return { sms, callScript, callAttemptId: callAttempt.id };
}

export async function classifyLeadFromTranscript(leadId: string, transcript: string) {
  const prompt = leadClassificationPrompt(transcript);
  const response = await callLLM(prompt);
  let status: LeadStatus = LeadStatus.ATTEMPTED;
  let motivationScore: number | null = null;
  try {
    const parsed = JSON.parse(response);
    status = parsed.status as LeadStatus;
    motivationScore = parsed.motivationScore ? Number(parsed.motivationScore) : null;
  } catch {
    logger.warn('Lead classification fallback to ATTEMPTED');
  }

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: { lastStatus: status, motivationScore },
  });

  if (status === LeadStatus.QUALIFIED_HOT) {
    notifyMe(updatedLead.id, updatedLead.propertyId);
  }

  return updatedLead;
}

export function notifyMe(leadId: string, propertyId: string) {
  logger.info('HOT lead detected', { leadId, propertyId });
}
