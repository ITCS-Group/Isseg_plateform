FROM node:18-alpine

WORKDIR /app

COPY apps/moodle-service/package*.json ./

RUN npm install

COPY apps/moodle-service .

EXPOSE 3002

CMD ["npm", "run", "dev"]