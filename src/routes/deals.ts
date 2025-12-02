import { Router } from 'express';
import { z } from 'zod';
import { createDeal, matchDealToBuyers, sendDealToBuyers } from '../modules/dispo/dealService';

const router = Router();

const createDealSchema = z.object({
  propertyId: z.string(),
  contractPrice: z.number(),
  arv: z.number().optional().nullable(),
  estimatedRepairs: z.number().optional().nullable(),
  assignmentFee: z.number().optional().nullable(),
});

router.post('/', async (req, res) => {
  const parsed = createDealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const deal = await createDeal(parsed.data);
  res.json({ success: true, deal });
});

router.post('/:id/match-buyers', async (req, res) => {
  const matches = await matchDealToBuyers(req.params.id);
  res.json({ success: true, matches });
});

router.post('/:id/send-to-buyers', async (req, res) => {
  const schema = z.object({ via: z.enum(['sms', 'email', 'both']).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const result = await sendDealToBuyers(req.params.id, parsed.data.via ?? 'sms');
  res.json({ success: true, ...result });
});

export default router;
