import { CreateTransferUseCase } from '../../src/application/create-transfer.use-case';
import { HandleCryptoWebhookUseCase } from '../../src/application/handle-crypto-webhook.use-case';
import { RequestDepositUseCase } from '../../src/application/request-deposit.use-case';
import { SimulateDepositUseCase } from '../../src/application/simulate-deposit.use-case';
import {
  IdempotencyKeyReuseError,
  InsufficientFundsError,
  InvalidWebhookSignatureError,
  SelfTransferError,
} from '../../src/domain/errors';
import { Money } from '../../src/domain/money';
import { InMemoryUnitOfWork, RecordingWebhookDelivery, StubCryptoProvider, StubWebhookSigner } from './fakes';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('CreateTransferUseCase', () => {
  async function setup(aliceBalance = '100') {
    const unitOfWork = new InMemoryUnitOfWork();
    await unitOfWork.fund(ALICE, aliceBalance, Money);
    return { unitOfWork, useCase: new CreateTransferUseCase(unitOfWork) };
  }

  const command = { senderUserId: ALICE, recipientUserId: BOB, amount: '40', idempotencyKey: 'key-0000001' };

  it('moves the money and writes both ledger entries', async () => {
    const { unitOfWork, useCase } = await setup();
    const result = await useCase.execute(command);

    expect(result.replayed).toBe(false);
    expect((await unitOfWork.wallets.findByUserId(ALICE))!.balance.toString()).toBe('60.00000000');
    expect((await unitOfWork.wallets.findByUserId(BOB))!.balance.toString()).toBe('40.00000000');
    expect(unitOfWork.ledger.items).toHaveLength(2);
    expect(unitOfWork.transfers.items).toHaveLength(1);
  });

  it('returns the first result when the same key is sent again, and moves money only once', async () => {
    const { unitOfWork, useCase } = await setup();
    const first = await useCase.execute(command);
    const second = await useCase.execute(command);

    expect(second.replayed).toBe(true);
    expect(second.transfer.id).toBe(first.transfer.id);
    expect(unitOfWork.transfers.items).toHaveLength(1);
    expect((await unitOfWork.wallets.findByUserId(ALICE))!.balance.toString()).toBe('60.00000000');
  });

  it('refuses the same key with a different body', async () => {
    const { useCase } = await setup();
    await useCase.execute(command);
    await expect(useCase.execute({ ...command, amount: '41' })).rejects.toThrow(IdempotencyKeyReuseError);
  });

  it('fails on low balance and stores nothing', async () => {
    const { unitOfWork, useCase } = await setup('10');
    await expect(useCase.execute(command)).rejects.toThrow(InsufficientFundsError);
    expect(unitOfWork.transfers.items).toHaveLength(0);
    expect(unitOfWork.ledger.items).toHaveLength(0);
  });

  it('refuses a transfer to yourself before touching any wallet', async () => {
    const { useCase } = await setup();
    await expect(useCase.execute({ ...command, recipientUserId: ALICE })).rejects.toThrow(SelfTransferError);
  });
});

describe('RequestDepositUseCase', () => {
  it('creates a pending deposit with an address and a locked USD value', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const useCase = new RequestDepositUseCase(unitOfWork, new StubCryptoProvider());
    const { deposit, replayed } = await useCase.execute({ userId: ALICE, idempotencyKey: 'dep-key-0001', asset: 'BTC', amount: '0.1' });

    expect(replayed).toBe(false);
    expect(deposit.status).toBe('pending');
    expect(deposit.creditAmount.toString()).toBe('5000.00000000');
    expect(deposit.address).toContain('BTC-address');
  });

  it('returns the same deposit for the same key', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const useCase = new RequestDepositUseCase(unitOfWork, new StubCryptoProvider());
    const first = await useCase.execute({ userId: ALICE, idempotencyKey: 'dep-key-0001', asset: 'USDT', amount: '50' });
    const second = await useCase.execute({ userId: ALICE, idempotencyKey: 'dep-key-0001', asset: 'USDT', amount: '50' });
    expect(second.replayed).toBe(true);
    expect(second.deposit.id).toBe(first.deposit.id);
    expect(unitOfWork.deposits.items.size).toBe(1);
  });

  it('refuses the same key for a different request', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const useCase = new RequestDepositUseCase(unitOfWork, new StubCryptoProvider());
    await useCase.execute({ userId: ALICE, idempotencyKey: 'dep-key-0001', asset: 'USDT', amount: '50' });
    await expect(useCase.execute({ userId: ALICE, idempotencyKey: 'dep-key-0001', asset: 'USDT', amount: '51' })).rejects.toThrow(
      IdempotencyKeyReuseError,
    );
  });
});

describe('HandleCryptoWebhookUseCase', () => {
  async function setup() {
    const unitOfWork = new InMemoryUnitOfWork();
    const signer = new StubWebhookSigner();
    const request = new RequestDepositUseCase(unitOfWork, new StubCryptoProvider());
    const { deposit } = await request.execute({ userId: ALICE, idempotencyKey: 'dep-key-0001', asset: 'USDT', amount: '25' });
    const webhook = new HandleCryptoWebhookUseCase(unitOfWork, signer);
    const event = { eventId: 'e1', type: 'deposit.confirmed' as const, address: deposit.address, asset: 'USDT' as const, amount: '25', txHash: 'tx1' };
    const rawBody = JSON.stringify(event);
    return { unitOfWork, webhook, event, rawBody, signature: signer.sign(rawBody), deposit };
  }

  it('credits the wallet once, even when the webhook comes twice', async () => {
    const { unitOfWork, webhook, event, rawBody, signature } = await setup();

    expect(await webhook.execute({ rawBody, signature, event })).toBe('confirmed');
    expect(await webhook.execute({ rawBody, signature, event })).toBe('already_processed');

    expect((await unitOfWork.wallets.findByUserId(ALICE))!.balance.toString()).toBe('25.00000000');
    expect(unitOfWork.ledger.items).toHaveLength(1);
    expect(unitOfWork.ledger.items[0].kind).toBe('deposit');
  });

  it('rejects a bad or missing signature and credits nothing', async () => {
    const { unitOfWork, webhook, event, rawBody } = await setup();
    await expect(webhook.execute({ rawBody, signature: 'bad', event })).rejects.toThrow(InvalidWebhookSignatureError);
    await expect(webhook.execute({ rawBody, signature: undefined, event })).rejects.toThrow(InvalidWebhookSignatureError);
    expect((await unitOfWork.wallets.findByUserId(ALICE))!.balance.toString()).toBe('0.00000000');
  });
});

describe('SimulateDepositUseCase', () => {
  it('signs the event and sends it to the given url', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const signer = new StubWebhookSigner();
    const delivery = new RecordingWebhookDelivery();
    const { deposit } = await new RequestDepositUseCase(unitOfWork, new StubCryptoProvider()).execute({
      userId: ALICE,
      idempotencyKey: 'dep-key-0001',
      asset: 'ETH',
      amount: '2',
    });

    await new SimulateDepositUseCase(unitOfWork, signer, delivery).execute({
      userId: ALICE,
      depositId: deposit.id,
      webhookUrl: 'http://127.0.0.1:3002/api/wallet/webhooks/crypto',
    });

    expect(delivery.sent).toHaveLength(1);
    const sent = delivery.sent[0];
    expect(sent.signature).toBe(signer.sign(sent.rawBody));
    expect(JSON.parse(sent.rawBody)).toMatchObject({ address: deposit.address, amount: '2.00000000', type: 'deposit.confirmed' });
  });
});
