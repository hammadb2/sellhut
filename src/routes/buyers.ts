import { Router } from 'express';
import { z } from 'zod';
import { BuyerStrategy, RehabLevel } from '@prisma/client';
import { createBuyer, deleteBuyer, listBuyers, updateBuyer } from '../modules/dispo/buyerService';

const router = Router();

const buyerSchema = z.object({
  name: z.string(),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  minPrice: z.number().optional().nullable(),
  maxPrice: z.number().optional().nullable(),
  targetZips: z.array(z.string()),
  strategy: z.nativeEnum(BuyerStrategy).optional().nullable(),
  maxRehabLevel: z.nativeEnum(RehabLevel).optional().nullable(),
});

router.post('/', async (req, res) => {
  const parsed = buyerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const buyer = await createBuyer(parsed.data);
  res.json({ success: true, buyer });
});

router.get('/', async (req, res) => {
  const { zip, strategy, minPrice, maxPrice } = req.query;
  const buyers = await listBuyers({
    zip: zip as string | undefined,
    strategy: strategy as BuyerStrategy | undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });
  res.json({ success: true, buyers });
});

router.patch('/:id', async (req, res) => {
  const parsed = buyerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const buyer = await updateBuyer(req.params.id, parsed.data);
  res.json({ success: true, buyer });
});

router.delete('/:id', async (req, res) => {
  const result = await deleteBuyer(req.params.id);
  res.json(result);
});

export default router;
