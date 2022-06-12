import { BigNumber } from '@ethersproject/bignumber';
import { hexValue, isHexString } from '@ethersproject/bytes';
import { Logger } from '@ethersproject/logger';
import { ApiPromise } from '@polkadot/api';
import type { GenericExtrinsic, i32, u64 } from '@polkadot/types';
import type { EventRecord } from '@polkadot/types/interfaces';
import type { EvmLog, H160, ExitReason } from '@polkadot/types/interfaces/types';
import type { FrameSystemEventRecord } from '@polkadot/types/lookup';
import { AnyTuple } from '@polkadot/types/types';
import { BIGNUMBER_ONE, BIGNUMBER_ZERO, DUMMY_R, DUMMY_S, DUMMY_V } from '../consts';
import { logger } from './logger';
import { nativeToEthDecimal } from './utils';
export interface PartialLog {
  removed: boolean;
  address: string;
  data: string;
  topics: string[];
  logIndex: number;
}

// TODO: where to find the actual shape?
export interface ExtrinsicMethodJSON {
  callIndex: string;
  args: {
    action?: {
      [key: string]: string;
    };
    init?: string;
    input?: string;
    target?: string;
    value: number;
    gas_limit: number;
    storage_limit: number;
    access_list: any[];
    valid_until?: number;
  };
}

export const getPartialLog = (evmLog: EvmLog, logIndex: number): PartialLog => {
  return {
    removed: false,
    address: evmLog.address.toString().toLowerCase(),
    data: evmLog.data.toString().toLowerCase(),
    topics: evmLog.topics.toJSON() as any,
    logIndex: logIndex
  };
};

export const getPartialLogs = (evmLogs: EvmLog[]): PartialLog[] => {
  return evmLogs.map((log, index) => getPartialLog(log, index));
};

export interface PartialTransactionReceipt {
  to?: string;
  from: string;
  logs: PartialLog[];
  contractAddress?: string;
  root?: string;
  logsBloom: string;
  byzantium: boolean;
  type: number;
  gasUsed: BigNumber;
  cumulativeGasUsed: BigNumber;
  status?: number;
  exitReason?: string;
}

const DUMMY_LOGS_BLOOM =
  '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export const getPartialTransactionReceipt = (event: FrameSystemEventRecord): PartialTransactionReceipt => {
  // @TODO
  const defaultValue = {
    logsBloom: DUMMY_LOGS_BLOOM,
    byzantium: false,
    // @TODO EIP712
    type: 0,
    cumulativeGasUsed: BIGNUMBER_ZERO
  };

  switch (event.event.method) {
    case 'Created': {
      const [source, evmAddress, logs, used_gas, _used_storage] = event.event.data as unknown as [
        H160,
        H160,
        EvmLog[],
        u64?,
        i32?
      ];

      return {
        to: undefined,
        from: source.toHex(),
        contractAddress: evmAddress.toString(),
        gasUsed: BigNumber.from(used_gas?.toString() || 0),
        status: 1,
        logs: getPartialLogs(logs),
        ...defaultValue
      };
    }
    case 'Executed': {
      const [source, evmAddress, logs, used_gas, _used_storage] = event.event.data as unknown as [
        H160,
        H160,
        EvmLog[],
        u64?,
        i32?
      ];

      return {
        to: evmAddress.toString(),
        from: source.toHex(),
        contractAddress: undefined,
        gasUsed: BigNumber.from(used_gas?.toString() || 0),
        logs: getPartialLogs(logs),
        status: 1,
        ...defaultValue
      };
    }
    case 'CreatedFailed': {
      const [source, evmAddress, _exitReason, logs, used_gas, _used_storage] = event.event.data as unknown as [
        H160,
        H160,
        ExitReason,
        EvmLog[],
        u64?,
        i32?
      ];

      return {
        to: undefined,
        from: source.toHex(),
        contractAddress: evmAddress.toString(),
        gasUsed: BigNumber.from(used_gas?.toString() || 0),
        logs: getPartialLogs(logs),
        status: 0,
        exitReason: _exitReason.toString(),
        ...defaultValue
      };
    }
    case 'ExecutedFailed': {
      const [source, evmAddress, _exitReason, _output, logs, used_gas, _used_storage] = event.event.data as unknown as [
        H160,
        H160,
        ExitReason,
        unknown,
        EvmLog[],
        u64?,
        i32?
      ];

      return {
        to: evmAddress.toString(),
        from: source.toHex(),
        contractAddress: undefined,
        gasUsed: BigNumber.from(used_gas?.toString() || 0),
        status: 0,
        exitReason: _exitReason.toString(),
        logs: getPartialLogs(logs),
        ...defaultValue
      };
    }
  }

  return logger.throwError(`unsupported event: ${event.event.method}`);
};

export const getEvmExtrinsicIndexes = (events: EventRecord[]): number[] => {
  return events
    .filter(
      (event) =>
        event.phase.isApplyExtrinsic &&
        event.event.section.toUpperCase() === 'EVM' &&
        ['Created', 'CreatedFailed', 'Executed', 'ExecutedFailed'].includes(event.event.method)
    )
    .reduce((r, event) => {
      const extrinsicIndex = event.phase.asApplyExtrinsic.toNumber();

      if (!r.length) {
        r = [extrinsicIndex];
      } else if (r[r.length - 1] !== extrinsicIndex) {
        r.push(extrinsicIndex);
      }

      return r;
    }, [] as number[]);
};

export const findEvmEvent = (events: EventRecord[]): EventRecord | undefined => {
  // For the moment the case of multiple evm events in one transaction is ignored
  return events.find(({ event }) => {
    return (
      event.section.toUpperCase() === 'EVM' &&
      ['Created', 'CreatedFailed', 'Executed', 'ExecutedFailed'].includes(event.method)
    );
  });
};

export const getTransactionIndexAndHash = (
  hashOrNumber: string | number,
  extrinsics: GenericExtrinsic[],
  events: EventRecord[]
): {
  transactionIndex: number;
  transactionHash: string;
  isExtrinsicFailed: boolean;
  extrinsicIndex: number;
} => {
  const evmExtrinsicIndexes = getEvmExtrinsicIndexes(events);
  const extrinsicsHashes = extrinsics.map((extrinsic) => extrinsic.hash.toHex());

  let extrinsicIndex: number | undefined = undefined;

  if (isHexString(hashOrNumber, 32)) {
    extrinsicIndex = extrinsicsHashes.findIndex((hash) => hashOrNumber === hash);
  } else {
    const index = BigNumber.from(hashOrNumber).toNumber();
    extrinsicIndex = evmExtrinsicIndexes[index];
  }

  const transactionHash = extrinsicIndex ? extrinsics[extrinsicIndex]?.hash.toHex() : undefined;

  if (extrinsicIndex === undefined || transactionHash === undefined || extrinsicIndex < 0) {
    return logger.throwError(`transaction hash not found`, Logger.errors.UNKNOWN_ERROR, {
      hashOrNumber
    });
  }

  const transactionIndex = evmExtrinsicIndexes.findIndex((index) => index === extrinsicIndex);

  if (transactionIndex < 0) {
    return logger.throwError(`expected extrinsic include evm events`, Logger.errors.UNKNOWN_ERROR, {
      hashOrNumber
    });
  }

  const isExtrinsicFailed = events[events.length - 1].event.method === 'ExtrinsicFailed';

  return {
    transactionIndex,
    transactionHash,
    extrinsicIndex,
    isExtrinsicFailed
  };
};

// parse info that can be extracted from extrinsic alone
export const parseExtrinsic = (
  extrinsic: GenericExtrinsic
): {
  value: string;
  gas: number;
  input: string;
  to: string | null;
  nonce: number;
  v: string;
  r: string;
  s: string;
} => {
  // TODO: get correct V_R_S
  const DUMMY_V_R_S = {
    v: DUMMY_V,
    r: DUMMY_R,
    s: DUMMY_S
  };

  const nonce = extrinsic.nonce.toNumber();

  const NONE_EVM_TX_DEFAULT_DATA = {
    value: '0x',
    gas: 2_100_000,
    input: '0x',
    to: null,
    nonce,
    ...DUMMY_V_R_S
  };

  if (extrinsic.method.section.toUpperCase() !== 'EVM') {
    return NONE_EVM_TX_DEFAULT_DATA;
  }

  const args = (extrinsic.method.toJSON() as ExtrinsicMethodJSON).args;

  return {
    value: hexValue(args.value || 0),
    gas: args.gas_limit || 0,
    input: args.input || args.init || '0x',
    to: args.action?.call || args.target || null,
    nonce,
    ...DUMMY_V_R_S
  };
};

export const getEffectiveGasPrice = async (
  evmEvent: EventRecord,
  api: ApiPromise,
  blockHash: string, // TODO: get blockHash from evmEvent?
  extrinsic: GenericExtrinsic<AnyTuple> // TODO: get extrinsic from evmEvent?
): Promise<BigNumber> => {
  const { data: eventData, method: eventMethod } = evmEvent.event;

  let gasPrice = BIGNUMBER_ONE;

  const gasInfoExists =
    eventData.length > 5 || (eventData.length === 5 && ['Created', 'Executed'].includes(eventMethod));

  if (gasInfoExists) {
    const used_gas = BigNumber.from(eventData[eventData.length - 2].toString());
    const used_storage = BigNumber.from(eventData[eventData.length - 1].toString());

    const block = await api.rpc.chain.getBlock(blockHash);
    // use parentHash to get tx fee
    const payment = await api.rpc.payment.queryInfo(extrinsic.toHex(), block.block.header.parentHash);
    // ACA/KAR decimal is 12. Mul 10^6 to make it 18.
    let tx_fee = nativeToEthDecimal(payment.partialFee.toString(), 12);

    // get storage fee
    // if used_storage > 0, tx_fee include the storage fee.
    if (used_storage.gt(0)) {
      tx_fee = tx_fee.add(used_storage.mul(api.consts.evm.storageDepositPerByte.toBigInt()));
    }

    gasPrice = tx_fee.div(used_gas);
  }

  return gasPrice;
};
