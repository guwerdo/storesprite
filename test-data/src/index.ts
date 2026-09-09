import fs from 'node:fs';
import path from 'node:path';
import { createUnasJsonClient } from '@storesprite/unas-json-client';
import { PayloadGenerator } from './services/payload-generator.js';
import { UnasWarehouseService } from './services/unas-warehouse-service.js';

function resolveApiKey(): string {
  const envKey = process.env.UNAS_API_KEY || process.env.API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  const keyCandidates = [
    path.resolve(process.cwd(), 'unas-api-key'),
    path.resolve(process.cwd(), 'test-data', 'unas-api-key'),
    path.resolve('/workspace/unas-api-key'),
    path.resolve('/workspace/test-data/unas-api-key'),
  ];

  for (const candidate of keyCandidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf-8').trim();
      if (content) {
        return content;
      }
    }
  }

  throw new Error('UNAS API Key not found. Please set UNAS_API_KEY environment variable or create unas-api-key file.');
}

async function main(): Promise<void> {
  try {
    console.log('=====================================================');
    console.log('UNAS Test Creator: JSON API Test Data Synchronizer');
    console.log('=====================================================');

    const apiKey = resolveApiKey();
    const client = createUnasJsonClient({ apiKey });

    const loginRes = await client.login(true);
    console.log(`[UNAS Auth] Authenticated successfully! (Shop ID: ${loginRes.shopId})`);

    const generator = new PayloadGenerator();
    const csvDir = generator.resolveDefaultCsvDir();
    const mappingPaths = generator.resolveMappingPaths(csvDir);

    console.log('-----------------------------------------------------');
    console.log('[UNAS Warehouse Sync] Checking & synchronizing warehouses...');
    const warehouseService = new UnasWarehouseService({ client });
    const syncResult = await warehouseService.syncWarehousesFromMappings(mappingPaths);

    console.log('[UNAS Warehouse Sync] Finished! Current Warehouse Map:');
    console.log(` - Existing in UNAS: ${syncResult.existingCount}`);
    console.log(` - Created in UNAS : ${syncResult.createdCount}`);
    console.log('-----------------------------------------------------');
    for (const [name, id] of syncResult.nameToId.entries()) {
      console.log(`  * ${name.padEnd(30)} -> ID: ${id}`);
    }
    console.log('-----------------------------------------------------');

    const genResult = generator.run({ csvDir, warehouseMap: syncResult.nameToId });
    console.log(`Total Products Prepared: ${genResult.totalProducts}`);

    const isDryRun = process.env.DRY_RUN === 'true';
    if (isDryRun) {
      console.log('[DRY RUN] Skipping product upload. Execution finished successfully.');
      return;
    }

    console.log('-----------------------------------------------------');
    console.log('[UNAS Product Upload] Uploading products in batches...');
    const uploadStats = await generator.uploadProducts(client, genResult.products);
    console.log('=====================================================');
    console.log('Generation & Upload Completed Successfully!');
    console.log(` - Uploaded OK: ${uploadStats.successCount}`);
    console.log(` - Errors     : ${uploadStats.errorCount}`);
    console.log('=====================================================');
  } catch (err) {
    console.error('[UNAS Test Creator] Fatal error:', err);
    process.exit(1);
  }
}

void main();
