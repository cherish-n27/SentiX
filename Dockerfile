FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
    && python3 -m pip install --break-system-packages nltk \
    && python3 -m nltk.downloader -d /usr/local/nltk_data vader_lexicon \
    && rm -rf /var/lib/apt/lists/*

ENV NLTK_DATA=/usr/local/nltk_data
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest && corepack pnpm install && corepack pnpm run build
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
