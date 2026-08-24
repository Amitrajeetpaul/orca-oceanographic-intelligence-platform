FROM node:22-slim

# Python + pip for the copernicusmarine CLI the Temperature agent shells out to.
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Install copernicusmarine into its own venv (Debian's system Python blocks
# global pip installs), then expose it on PATH.
RUN python3 -m venv /opt/copernicusmarine-venv && \
    /opt/copernicusmarine-venv/bin/pip install --no-cache-dir copernicusmarine
ENV PATH="/opt/copernicusmarine-venv/bin:${PATH}"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
