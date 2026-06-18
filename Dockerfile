# Not support for Alpine based image: https://github.com/livekit/node-sdks/issues/316
FROM node:24-slim@sha256:c2d5ade763cacfb03fe9cb8e8af5d1be5041ff331921fa26a9b231ca3a4f780a AS builderenv

WORKDIR /app

# Install only the essential build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libc6-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# build the app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# remove devDependencies, keep only used dependencies
RUN yarn install --prod --frozen-lockfile

########################## END OF BUILD STAGE ##########################

FROM node:24-slim@sha256:c2d5ade763cacfb03fe9cb8e8af5d1be5041ff331921fa26a9b231ca3a4f780a

# Install only the essential runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    libc6-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# NODE_ENV is used to configure some runtime options, like JSON logger
ENV NODE_ENV=production

ARG COMMIT_HASH=local
ENV COMMIT_HASH=${COMMIT_HASH:-local}

ARG CURRENT_VERSION=Unknown
ENV CURRENT_VERSION=${CURRENT_VERSION:-Unknown}

WORKDIR /app
COPY --from=builderenv /app /app

RUN echo "" > /app/.env

ENTRYPOINT ["tini", "--"]
CMD [ "/usr/local/bin/node", "--trace-warnings", "--abort-on-uncaught-exception", "--unhandled-rejections=strict", "dist/index.js" ]
