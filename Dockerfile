# NETMED — Dockerfile per il servizio Node.js
# Usa l'immagine ufficiale Node 18 (LTS).
FROM node:18-alpine

WORKDIR /app

# Copia SOLO i file di dipendenze per sfruttare la cache Docker
COPY package*.json ./

# Installa dipendenze di produzione
RUN npm install --omit=dev

# Copia il resto del progetto
COPY . .

# Porta esposta dal server Express
EXPOSE 3000

# Avvio
CMD ["node", "server.js"]
