import { Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { COMMON_CONFIG, CommonConfig, extractAccessTokenFromCookies, parseCookieHeader, verifyAccessToken } from '@tradedesk/common';
import { Namespace, Socket } from 'socket.io';
import { TickPublisher } from '../../domain/ports';
import { PriceTick } from '../../domain/tick';
import { filterForSubscriber, TickBatcher } from './tick-batcher';

export const TICK_BATCH_INTERVAL_MS = 250;
const MAX_SYMBOLS_PER_CLIENT = 100;

interface SymbolsMessage {
  symbols?: unknown;
}

/**
 * socket.io namespace /market.
 * The handshake must carry the access_token cookie. Clients send `subscribe` and `unsubscribe`
 * with { symbols: ["BTC"] } and receive `ticks` events with batches, at most every 250 ms.
 */
@WebSocketGateway({ namespace: '/market', cors: { origin: true, credentials: true } })
export class MarketGateway implements OnGatewayInit, OnModuleDestroy, TickPublisher {
  @WebSocketServer()
  private server: Namespace;

  private readonly logger = new Logger(MarketGateway.name);
  private readonly batcher = new TickBatcher();
  private flushTimer?: NodeJS.Timeout;

  constructor(@Inject(COMMON_CONFIG) private readonly config: CommonConfig) {}

  afterInit(server: Namespace): void {
    server.use((socket, next) => {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = extractAccessTokenFromCookies(cookies);
      const user = token ? verifyAccessToken(token, this.config.jwtSecret) : null;
      if (!user) {
        next(new Error('unauthorized'));
        return;
      }
      socket.data.user = user;
      socket.data.symbols = new Set<string>();
      next();
    });
    this.flushTimer = setInterval(() => this.flush(), TICK_BATCH_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }

  publish(ticks: PriceTick[]): void {
    this.batcher.add(ticks);
  }

  @SubscribeMessage('subscribe')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: SymbolsMessage): { event: string; data: { symbols: string[] } } {
    const subscribed = client.data.symbols as Set<string>;
    for (const symbol of parseSymbols(body)) {
      if (subscribed.size >= MAX_SYMBOLS_PER_CLIENT) {
        break;
      }
      subscribed.add(symbol);
    }
    return { event: 'subscribed', data: { symbols: [...subscribed] } };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: SymbolsMessage): { event: string; data: { symbols: string[] } } {
    const subscribed = client.data.symbols as Set<string>;
    for (const symbol of parseSymbols(body)) {
      subscribed.delete(symbol);
    }
    return { event: 'subscribed', data: { symbols: [...subscribed] } };
  }

  /** Sends the collected ticks to every client, filtered by what that client subscribed to. */
  flush(): void {
    const batch = this.batcher.drain();
    if (batch.length === 0 || !this.server) {
      return;
    }
    for (const socket of this.server.sockets.values()) {
      const mine = filterForSubscriber(batch, socket.data.symbols as Set<string>);
      if (mine.length > 0) {
        socket.emit('ticks', mine);
      }
    }
  }
}

function parseSymbols(body: SymbolsMessage | undefined): string[] {
  if (!body || !Array.isArray(body.symbols)) {
    return [];
  }
  return body.symbols.filter((symbol): symbol is string => typeof symbol === 'string' && symbol.length <= 20).map((symbol) => symbol.trim().toUpperCase());
}
