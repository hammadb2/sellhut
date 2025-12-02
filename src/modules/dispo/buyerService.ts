import { Buyer, BuyerStrategy, Prisma, RehabLevel } from '@prisma/client';
import { prisma } from '../../db/client';
import { buyerSummaryPrompt, callLLM } from '../ai';

export type BuyerInput = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  notes?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  targetZips: string[];
  strategy?: BuyerStrategy | null;
  maxRehabLevel?: RehabLevel | null;
};

export async function generateBuyerSummary(input: BuyerInput) {
  const prompt = buyerSummaryPrompt({
    name: input.name,
    minPrice: input.minPrice ?? undefined,
    maxPrice: input.maxPrice ?? undefined,
    targetZips: input.targetZips,
    strategy: input.strategy ?? undefined,
    maxRehabLevel: input.maxRehabLevel ?? undefined,
  });
  const response = await callLLM(prompt);
  return response;
}

export async function createBuyer(input: BuyerInput): Promise<Buyer> {
  const aiBuyBoxSummary = await generateBuyerSummary(input);
  return prisma.buyer.create({ data: { ...input, aiBuyBoxSummary } });
}

export async function listBuyers(filters: { zip?: string; strategy?: BuyerStrategy; minPrice?: number; maxPrice?: number }): Promise<Buyer[]> {
  const where: Prisma.BuyerWhereInput = {};
  if (filters.zip) {
    where.targetZips = { has: filters.zip };
  }
  if (filters.strategy) {
    where.strategy = filters.strategy;
  }
  if (filters.minPrice || filters.maxPrice) {
    where.AND = [
      filters.minPrice ? { minPrice: { gte: filters.minPrice } } : {},
      filters.maxPrice ? { maxPrice: { lte: filters.maxPrice } } : {},
    ];
  }
  return prisma.buyer.findMany({ where });
}

export async function updateBuyer(id: string, input: Partial<BuyerInput>): Promise<Buyer> {
  const aiBuyBoxSummary = input.targetZips || input.strategy || input.maxRehabLevel || input.minPrice || input.maxPrice
    ? await generateBuyerSummary({
        name: input.name ?? 'Buyer',
        targetZips: input.targetZips ?? [],
        strategy: input.strategy ?? null,
        maxRehabLevel: input.maxRehabLevel ?? null,
        minPrice: input.minPrice ?? null,
        maxPrice: input.maxPrice ?? null,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        city: input.city ?? null,
        notes: input.notes ?? null,
      })
    : undefined;

  return prisma.buyer.update({
    where: { id },
    data: { ...input, aiBuyBoxSummary: aiBuyBoxSummary ?? undefined },
  });
}

export async function deleteBuyer(id: string) {
  await prisma.buyer.delete({ where: { id } });
  return { success: true };
}
