import { createApp } from './app';
import { createProductionContainer } from './container';
import { loadEnv } from './env';

const env = loadEnv();
const container = createProductionContainer(env);
const { httpServer, io } = createApp(container);

httpServer.listen(env.PORT, () => {
  console.log(
    `[Smart Kanban] Backend rodando em http://localhost:${env.PORT} (modelo IA: ${env.GEMINI_API_KEY ? env.GEMINI_MODEL : 'fallback-deterministic'})`,
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[Smart Kanban] Encerrando (${signal})...`);
  io.close();
  httpServer.close(async () => {
    if (container.prisma) {
      await container.prisma.$disconnect();
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
