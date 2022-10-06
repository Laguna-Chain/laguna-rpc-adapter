import { EvmRpcProvider } from '@acala-network/eth-providers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Eip1193Bridge } from '../../eip1193-bridge';
import dotenv from 'dotenv';

dotenv.config();
// set it to local chain
const endpoint = process.env.TEST_WS_ENDPOINT || 'wss://laguna-chain-dev.hydrogenx.live';
chai.use(chaiAsPromised);

describe('eth_chainId', () => {
  let provider;
  let bridge;

  beforeEach(() => {
    provider = EvmRpcProvider.from(endpoint);

    bridge = new Eip1193Bridge(provider);
  });

  afterEach(() => {
    provider.disconnect();
  });

  test('eth_chainId', async () => {
    const result = await bridge.send('eth_chainId');
    expect(result).equal('0x3e8');
  });
});
