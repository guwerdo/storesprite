import { PayloadGenerator } from './services/payload-generator.js';
import { UnasAuthService } from './services/unas-auth-service.js';
import { UnasWarehouseService } from './services/unas-warehouse-service.js';

async function main(): Promise<void> {
  try {
    console.log('=====================================================');
    console.log('UNAS Test Creator: CSV to UNAS setProduct XML Builder');
    console.log('=====================================================');

    const authService = new UnasAuthService();
    const token = await authService.getValidToken();
    console.log(`[UNAS Auth] Authenticated successfully (Token: ${token.slice(0, 8)}...${token.slice(-4)})`);

    const generator = new PayloadGenerator();
    const csvDir = generator.resolveDefaultCsvDir();

    console.log('-----------------------------------------------------');
    console.log('[UNAS Warehouse Sync] Checking & synchronizing warehouses...');
    const warehouseService = new UnasWarehouseService({ authService });
    const syncResult = await warehouseService.syncWarehousesFromMappings(csvDir);

    console.log('[UNAS Warehouse Sync] Finished! Current Warehouse Map:');
    console.log(` - Existing in UNAS: ${syncResult.existingCount}`);
    console.log(` - Created in UNAS : ${syncResult.createdCount}`);
    console.log('-----------------------------------------------------');
    console.log('Warehouse Name -> UNAS ID:');
    for (const [name, id] of syncResult.nameToId.entries()) {
      console.log(`  * ${name.padEnd(30)} -> ID: ${id}`);
    }
    console.log('-----------------------------------------------------');

    const result = generator.run({ csvDir, warehouseMap: syncResult.nameToId });

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

