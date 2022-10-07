import { EvmRpcProvider } from '@acala-network/eth-providers';
import { Eip1193Bridge } from '../../eip1193-bridge';
import dotenv from 'dotenv';

dotenv.config();
// set it to local chain
const endpoint = process.env.TEST_WS_ENDPOINT || 'wss://laguna-chain-dev.hydrogenx.live';

describe('rpc methods', () => {
  const provider = EvmRpcProvider.from(endpoint);

  const bridge = new Eip1193Bridge(provider);

  afterAll(() => {
    provider.disconnect();
  });

  test('eth_chainId', async () => {
    const result = await bridge.send('eth_chainId');
    expect(result).toBe('0x3e8');
  });

  test('net_version', async () => {
    const result = await bridge.send('net_version');
    expect(result.toString()).toBe('1000');
  });

  test('web3_clientVersion', async () => {
    const result = await bridge.send('web3_clientVersion');
    expect(result).toBe('Laguna/v1');
  });
});
