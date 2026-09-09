import { PayloadGenerator } from './services/payload-generator.js';
import { UnasAuthService } from './services/unas-auth-service.js';

async function main(): Promise<void> {
  try {
    console.log('=====================================================');
    console.log('UNAS Test Creator: CSV to UNAS setProduct XML Builder');
    console.log('=====================================================');

    const authService = new UnasAuthService();
    const token = await authService.getValidToken();
    console.log(`[UNAS Auth] Authenticated successfully (Token: ${token.slice(0, 8)}...${token.slice(-4)})`);

    const generator = new PayloadGenerator();
    const result = generator.run();

    console.log('=====================================================');
    console.log(`Generation Completed Successfully!`);
    console.log(`Total Products : ${result.totalProducts}`);
    for (const [supplier, count] of Object.entries(result.supplierCounts)) {
      console.log(` - ${supplier.padEnd(12)}: ${count} products`);
    }
    console.log(`Output File    : ${result.outputFilePath}`);
    console.log('=====================================================');
  } catch (err) {
    console.error('[UNAS Test Creator] Fatal error generating payload XML:', err);
    process.exit(1);
  }
}

void main();

