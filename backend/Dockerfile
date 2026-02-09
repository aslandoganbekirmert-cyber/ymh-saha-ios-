
# Production için Dockerfile
FROM node:18-alpine

WORKDIR /app

# Gerekli kütüphaneleri yükle (Build için devDependencies lazım)
COPY package*.json ./
# npm ci daha hızlıdır
RUN npm ci

# Kodları kopyala
COPY . .

# Build al
RUN npm run build

# Portu aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["node", "dist/main"]
