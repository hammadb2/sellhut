import express from 'express';
import cron from 'node-cron';
import { env } from './config/env';
import { logger } from './config/logger';
import acquisitionsRouter from './routes/acquisitions';
import buyersRouter from './routes/buyers';
import dealsRouter from './routes/deals';
import webhooksRouter from './routes/webhooks';
import { requireApiKey } from './routes/middleware';
import { batchScoreNewProperties } from './modules/acquisitions/acquisitionService';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', requireApiKey, acquisitionsRouter);
app.use('/api/buyers', requireApiKey, buyersRouter);
app.use('/api/deals', requireApiKey, dealsRouter);
app.use('/api/webhooks', webhooksRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

cron.schedule('0 2 * * *', async () => {
  logger.info('Running nightly property scoring');
  await batchScoreNewProperties();
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(Number(env.PORT), () => {
  logger.info(`Sell Hut API listening on port ${env.PORT}`);
});
