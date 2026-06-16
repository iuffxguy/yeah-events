# Yeah Events — External Agents Container
# Runs on home server (Unraid). Connects to Vercel Postgres via DATABASE_URL.
#
# Build:   docker build -t yeah-agents .
# Run:     docker run --env-file .env yeah-agents node scrape-events.js
# Cron:    docker run -d --env-file .env --name yeah-agents-cron yeah-agents cron -f

FROM node:20-slim

# Install system deps required by Playwright's Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    cron \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Tell Playwright to use the system Chromium instead of downloading its own
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install Playwright browser (uses system Chromium via env var above)
RUN npx playwright install chromium

# Copy agent source
COPY . .

# Install cron schedule
COPY crontab /etc/cron.d/yeah-agents
RUN chmod 0644 /etc/cron.d/yeah-agents && \
    crontab /etc/cron.d/yeah-agents

# Expose env vars to cron jobs (cron doesn't inherit shell env)
# The .env file is mounted at runtime via: docker run --env-file .env
# We write them to /etc/environment so cron picks them up.
CMD ["sh", "-c", "printenv | grep -E '^(DATABASE_URL|OLLAMA_URL|OLLAMA_MODEL)=' >> /etc/environment && cron -f"]
