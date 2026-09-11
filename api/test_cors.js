import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify();
await app.register(cors, {
  origin: ['http://127.0.0.1:8080']
});

app.get('/', async () => 'hello');

app.listen({ port: 9999 }).then(() => console.log('started'));
