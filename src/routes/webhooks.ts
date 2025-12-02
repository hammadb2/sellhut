import { Router } from 'express';
import { handleBuyerSmsReply } from '../modules/dispo/dealService';

const router = Router();

router.post('/twilio-sms', async (req, res) => {
  const from = req.body.From || req.body.from;
  const body = req.body.Body || req.body.body;
  if (!from || !body) return res.status(400).json({ error: 'Missing from/body' });
  const classification = await handleBuyerSmsReply(from, body);
  res.json({ success: true, classification });
});

export default router;
