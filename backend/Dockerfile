# Dockerfile do backend (NestJS) — ambiente de desenvolvimento.
#
# O código-fonte é sobrescrito em runtime pelo bind mount definido
# no docker-compose.yml (./backend:/app), então o COPY aqui serve
# principalmente para a primeira build e para builds sem o volume
# montado (ex.: CI). O node_modules instalado na imagem também é
# preservado por um volume anônimo no compose, evitando conflito
# com o node_modules do host.

FROM node:22-slim

WORKDIR /app

# Copia só os manifests primeiro para aproveitar o cache de camadas:
# o npm install só roda de novo se package.json/package-lock.json mudarem.
COPY package*.json ./
RUN npm install

# Copia o restante do código (será substituído pelo bind mount em dev).
COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]