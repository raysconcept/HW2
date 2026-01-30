# syntax=docker/dockerfile:1.6

###############
# Base image  #
###############
# Provide a common starting point so builder and runtime share the same OS bits.
FROM node:18-bullseye-slim AS base

# Avoid prompts and speed up apt usage.
ENV DEBIAN_FRONTEND=noninteractive

###############
# Dependencies#
###############
# Install build tooling and compile npm dependencies in a clean layer.
FROM base AS deps

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    make \
    g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only copy lockfiles/package manifests to maximise caching.
COPY package*.json ./

# Install JS dependencies exactly as defined in package-lock.json
RUN npm ci

################
# Runtime image#
################
FROM base AS runtime

# System packages needed at runtime (ffmpeg, udev, etc).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg \
    udev \
    netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules from the deps stage, then the rest of the source.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy entrypoint script and ensure it's executable.
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Environment defaults (can be overridden via `docker run -e …`).
ENV NODE_ENV=production \
    HW_SERVER_PORT=3101 \
    HW_CALIBRATION_STATE_PATH=/app/calibration-data/calibrationState.json

# Expose the application port.
EXPOSE 3101

# Use custom entrypoint which prepares writable directories then starts the app as `node` user.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
