# Base stage for setting up pnpm
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS build
WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the API workspace (and any local dependencies)
RUN pnpm --filter @agenthub-tools/api build

# Prune the workspace to just the API and its production dependencies
# This creates a standalone folder with only what's needed to run
RUN pnpm --filter @agenthub-tools/api deploy --prod --legacy /prod/api

# Final production stage
FROM node:20-slim AS final
WORKDIR /app

# Copy the pruned application from the build stage
COPY --from=build /prod/api .

# Expose the default port (Northflank will pass its own PORT env var)
EXPOSE 8081
ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=cloud

# Start the API
CMD ["npm", "run", "start"]
