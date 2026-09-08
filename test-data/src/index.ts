import { PayloadGenerator } from './services/payload-generator.js';

function main(): void {
  try {
    console.log('=====================================================');
    console.log('UNAS Test Creator: CSV to UNAS setProduct XML Builder');
    console.log('=====================================================');

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

main();
