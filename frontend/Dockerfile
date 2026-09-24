# Dockerfile do frontend (Next.js) — ambiente de desenvolvimento.
#
# Assim como no backend, o código-fonte é sobrescrito em runtime
# pelo bind mount definido no docker-compose.yml (./frontend:/app).
# Este Dockerfile garante que a imagem já suba com as dependências
# instaladas, aproveitando cache de camadas do Docker.

FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "-p", "3001"]