# Cave adapter image for Terminal-Bench.
#
# Extends the TB base image with Node.js 20 + a global cave install. The
# running container expects one of two auth modes:
#
#   subscription mode: the runner bind-mounts ~/.config/cave/auth.json from
#   the host into the container (ChatGPT-plan token).
#
#   api-key mode: OPENAI_API_KEY is set in the container env; the adapter's
#   setup_commands writes a minimal auth.json on first run.
#
# Pin the base image tag to the TB version you installed in requirements.txt;
# mismatched versions silently break adapter loading.

ARG TB_BASE_IMAGE=ghcr.io/laude-institute/terminal-bench/tb-base:latest
FROM ${TB_BASE_IMAGE}

ARG CAVE_VERSION=latest

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg; \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; \
    apt-get install -y --no-install-recommends nodejs; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    npm install -g cave@${CAVE_VERSION}

RUN mkdir -p /root/.config/cave

# TB mounts the workspace in at runtime; nothing to COPY at build time.
WORKDIR /workspace

CMD ["bash"]
