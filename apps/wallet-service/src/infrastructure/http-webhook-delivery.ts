import { WebhookDelivery } from '../domain/ports';

export class HttpWebhookDelivery implements WebhookDelivery {
  async deliver(url: string, rawBody: string, signature: string): Promise<{ status: number; body: unknown }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': signature },
      body: rawBody,
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep the text
    }
    return { status: response.status, body };
  }
}
