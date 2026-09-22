# Ghidra requires JDK 21. eclipse-temurin is the standard OpenJDK image.
FROM eclipse-temurin:21-jdk-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download the latest public Ghidra release directly from GitHub during the
# BUILD step (which has network access) so the final RUNTIME container can
# stay fully network-isolated (--network=none), per the sandbox's security
# model. The download URL is resolved dynamically via the GitHub API rather
# than hardcoded, since Ghidra's exact release tag format can change between
# versions.
RUN set -eux; \
    ASSET_URL=$(curl -s https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/latest \
      | grep '"browser_download_url".*_PUBLIC_.*\.zip"' \
      | grep -v -i "source" \
      | cut -d '"' -f 4 | head -n 1); \
    echo "Resolved Ghidra download URL: $ASSET_URL"; \
    if [ -z "$ASSET_URL" ]; then echo "ERROR: could not resolve Ghidra release URL"; exit 1; fi; \
    curl -L -o /tmp/ghidra.zip "$ASSET_URL"; \
    unzip -q /tmp/ghidra.zip -d /opt; \
    mv /opt/ghidra_* /opt/ghidra; \
    rm /tmp/ghidra.zip

ENV GHIDRA_HOME=/opt/ghidra

WORKDIR /app
COPY server.py /app/server.py
COPY scripts/DecompileAll.java /app/scripts/DecompileAll.java

# No ENTRYPOINT/CMD set here on purpose: the platform runs this image with
# the manifest's own "entrypoint" array appended as the docker run command,
# matching exactly how the default node:20-alpine tools are invoked today.
