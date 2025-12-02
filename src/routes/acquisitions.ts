import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { contactLead, importPropstreamCsv, scorePropertyAndLead } from '../modules/acquisitions/acquisitionService';
import { prisma } from '../db/client';

const router = Router();
const upload = multer();

router.post('/acquisitions/import-propstream', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  try {
    const result = await importPropstreamCsv(req.file.buffer);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/leads/:id/contact', async (req, res) => {
  const schema = z.object({ sendSms: z.boolean().optional() });
  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) return res.status(400).json({ error: parseResult.error.format() });
  try {
    const result = await contactLead(req.params.id, { sendSms: parseResult.data.sendSms ?? false });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/properties/:id/score', async (req, res) => {
  try {
    const result = await scorePropertyAndLead(req.params.id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/properties', async (req, res) => {
  const { status, zip, motivationScoreMin } = req.query;
  const where: any = {};
  if (status) where.status = status;
  if (zip) where.zip = zip;
  if (motivationScoreMin) where.motivationScore = { gte: Number(motivationScoreMin) };
  const properties = await prisma.property.findMany({ where, include: { leads: true } });
  res.json({ success: true, properties });
});

export default router;
