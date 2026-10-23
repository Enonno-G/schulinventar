# Bauplan für den Container „app“: Node.js mit dem Schulinventar.

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# Zuerst nur die Paketlisten kopieren und Pakete installieren (wird zwischengespeichert, geht beim nächsten Mal schneller)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Dann den eigenen Code
COPY src src
COPY views views
COPY public public
COPY datenbank datenbank

# Ordner für hochgeladene Belege
RUN mkdir -p /data/uploads && chown node:node /data/uploads

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/start.js"]
