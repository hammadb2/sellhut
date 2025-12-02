import { DealStatus } from '@prisma/client';
import nodemailer from 'nodemailer';
import { prisma } from '../../db/client';
import { callLLM, dealMarketingPrompt, buyerResponsePrompt } from '../ai';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { sendSms } from '../twilio';

export async function createDeal(input: {
  propertyId: string;
  contractPrice: number;
  arv?: number | null;
  estimatedRepairs?: number | null;
  assignmentFee?: number | null;
}) {
  const property = await prisma.property.findUnique({ where: { id: input.propertyId } });
  if (!property) throw new Error('Property not found');

  const prompt = dealMarketingPrompt({
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    contractPrice: input.contractPrice,
    arv: input.arv ?? property.arvEstimate,
    estimatedRepairs: input.estimatedRepairs,
  });
  const response = await callLLM(prompt);
  let emailBlurb: string | undefined;
  try {
    const parsed = JSON.parse(response);
    emailBlurb = parsed.emailBlurb || parsed.smsLine;
  } catch {
    emailBlurb = response;
  }

  return prisma.deal.create({
    data: {
      propertyId: input.propertyId,
      contractPrice: input.contractPrice,
      arv: input.arv,
      estimatedRepairs: input.estimatedRepairs,
      assignmentFee: input.assignmentFee,
      aiSummary: emailBlurb,
      status: DealStatus.OPEN,
    },
  });
}

export async function matchDealToBuyers(dealId: string, threshold = 60) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { property: true },
  });
  if (!deal) throw new Error('Deal not found');

  const buyers = await prisma.buyer.findMany();
  const matches = [] as any[];
  for (const buyer of buyers) {
    let score = 0;
    if (buyer.targetZips.includes(deal.property.zip)) score += 40;
    if (buyer.minPrice && deal.contractPrice >= buyer.minPrice) score += 15;
    if (buyer.maxPrice && deal.contractPrice <= buyer.maxPrice) score += 15;
    if (buyer.strategy) score += 10;
    if (buyer.maxRehabLevel) score += 10;
    if (score >= threshold) {
      const match = await prisma.dispoMatch.create({
        data: {
          dealId: deal.id,
          buyerId: buyer.id,
          matchScore: Math.min(score, 100),
        },
      });
      matches.push(match);
    }
  }
  return matches;
}

export async function sendDealSms(matchId: string) {
  const match = await prisma.dispoMatch.findUnique({
    where: { id: matchId },
    include: { deal: { include: { property: true } }, buyer: true },
  });
  if (!match) throw new Error('Match not found');
  const { property, contractPrice, arv } = match.deal;
  const message = `Off-market deal in ${property.zip}: ${property.beds ?? '?'}bd/${property.baths ?? '?'}ba, $${contractPrice} vs ARV ${
    arv ?? property.arvEstimate ?? '?'
  }. Reply YES for details. – Sell Hut Properties`;
  if (match.buyer.phone) {
    await sendSms(match.buyer.phone, message);
    await prisma.dispoMatch.update({ where: { id: matchId }, data: { sentAt: new Date(), sentVia: 'sms' } });
  }
  return { message };
}

export async function sendDealEmail(matchId: string) {
  const match = await prisma.dispoMatch.findUnique({
    where: { id: matchId },
    include: { deal: { include: { property: true } }, buyer: true },
  });
  if (!match) throw new Error('Match not found');

  if (!env.SMTP_HOST) {
    logger.warn('SMTP settings missing, email not sent');
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: false,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  });

  const subject = match.deal.aiSummary
    ? `Off-market deal – ${match.deal.aiSummary.slice(0, 40)}`
    : `Off-market deal – ${match.deal.property.address}`;
  const body = match.deal.aiSummary ??
    `Property: ${match.deal.property.address}, ${match.deal.property.city} ${match.deal.property.state} ${match.deal.property.zip}
Price: $${match.deal.contractPrice}
ARV: ${match.deal.arv ?? match.deal.property.arvEstimate ?? 'n/a'}
Repairs: ${match.deal.estimatedRepairs ?? 'n/a'}
Assignment Fee: ${match.deal.assignmentFee ?? 'n/a'}
Reply YES for details.`;

  if (match.buyer.email) {
    await transporter.sendMail({ from: 'deals@sellhut.com', to: match.buyer.email, subject, text: body });
    await prisma.dispoMatch.update({ where: { id: matchId }, data: { sentAt: new Date(), sentVia: 'email' } });
  }
  return { sent: true };
}

export async function sendDealToBuyers(dealId: string, via: 'sms' | 'email' | 'both' = 'sms', threshold = 60) {
  const matches = await prisma.dispoMatch.findMany({ where: { dealId, matchScore: { gte: threshold } } });
  for (const match of matches) {
    if (via === 'sms' || via === 'both') {
      await sendDealSms(match.id);
    }
    if (via === 'email' || via === 'both') {
      await sendDealEmail(match.id);
    }
  }
  return { sent: matches.length };
}

export async function handleBuyerSmsReply(from: string, body: string) {
  const buyer = await prisma.buyer.findFirst({ where: { phone: from } });
  if (!buyer) return null;
  const match = await prisma.dispoMatch.findFirst({ where: { buyerId: buyer.id }, orderBy: { sentAt: 'desc' } });
  if (!match) return null;
  const prompt = buyerResponsePrompt(body);
  const response = await callLLM(prompt);
  let classification = 'question';
  try {
    const parsed = JSON.parse(response);
    classification = parsed.classification || classification;
  } catch {
    classification = response;
  }
  await prisma.dispoMatch.update({ where: { id: match.id }, data: { buyerResponse: classification } });
  if (classification === 'interested') {
    logger.info('Buyer interested', { buyerId: buyer.id, dealId: match.dealId });
  }
  return classification;
}
