import { env } from '../../config/env';
import { logger } from '../../config/logger';

export async function sendSms(to: string, body: string) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    logger.warn('Twilio credentials missing, SMS not sent. Body:', body);
    return { sid: 'stub', status: 'not_sent' };
  }
  const client = await import('twilio');
  const twilioClient = client.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const result = await twilioClient.messages.create({
    from: env.TWILIO_PHONE_NUMBER,
    to,
    body,
  });
  logger.info('SMS sent', result.sid);
  return result;
}

export async function initiateCall(to: string) {
  logger.info('Placeholder for outbound call to', to);
}
