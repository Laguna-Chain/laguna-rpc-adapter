import { EvmRpcProvider } from '@acala-network/eth-providers';
import { Eip1193Bridge } from '../../eip1193-bridge';
import dotenv from 'dotenv';

dotenv.config();
// set it to local chain
const endpoint = process.env.TEST_WS_ENDPOINT || 'wss://laguna-chain-dev.hydrogenx.live';

describe('web3_clientVersion', () => {
  let provider;
  let bridge;

  beforeEach(() => {
    provider = EvmRpcProvider.from(endpoint);

    bridge = new Eip1193Bridge(provider);
  });

  afterEach(() => {
    provider.disconnect();
  });

  test('web3_clientVersion', async () => {
    const result = await bridge.send('web3_clientVersion');
    expect(result).toBe('Laguna/v1');
  });
});
