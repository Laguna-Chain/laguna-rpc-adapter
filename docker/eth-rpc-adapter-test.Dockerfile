# =============== feed-tx =============== #
FROM node:16-alpine as feed-tx
COPY --from=bodhi-base /app /app
RUN npm install -g @microsoft/rush@5.55.0

WORKDIR /app
COPY examples/waffle ./examples/waffle

WORKDIR /app/examples/waffle/dex
RUN rush build -o .

ENV ENDPOINT_URL=ws://mandala-node:9944
CMD ["yarn", "test"]

# =============== feed-tx-dex-erc20 =============== #
FROM node:16-alpine as feed-tx-dex-erc20
COPY --from=bodhi-base /app /app
RUN npm install -g @microsoft/rush@5.55.0

WORKDIR /app
COPY examples/waffle ./examples/waffle

WORKDIR /app/examples/waffle/e2e
RUN rush build -o .

ENV ENDPOINT_URL=ws://mandala-node:9944
CMD ["yarn", "test-dex"]

# =============== eth-rpc-adapter-test =============== #
FROM node:16-alpine as eth-rpc-adapter-test
COPY --from=bodhi-base /app /app

WORKDIR /app
COPY eth-rpc-adapter ./eth-rpc-adapter

WORKDIR /app/eth-rpc-adapter
ENV ENDPOINT_URL=ws://mandala-node:9944
ENV SUBQL_URL=http://graphql-engine:3001
ENV RPC_URL=http://eth-rpc-adapter-server-with-subql:8545
ENV WS_URL=ws://eth-rpc-adapter-server-with-subql:8545
ENV KARURA_ETH_RPC_URL=http://eth-rpc-adapter-server-karura:8546
CMD ["yarn", "test:CI"]
