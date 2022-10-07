import { EvmRpcProvider } from '@acala-network/eth-providers';
import { Eip1193Bridge } from '../../eip1193-bridge';
import dotenv from 'dotenv';

dotenv.config();
// set it to local chain
const endpoint = process.env.TEST_WS_ENDPOINT || 'wss://laguna-chain-dev.hydrogenx.live';

describe('net_version', () => {
  let provider;
  let bridge;

  beforeEach(() => {
    provider = EvmRpcProvider.from(endpoint);

    bridge = new Eip1193Bridge(provider);
  });

  afterEach(() => {
    provider.disconnect();
  });

  test('net_version', async () => {
    const result = await bridge.send('net_version');
    expect(result).toBe(1000);
  });
});
