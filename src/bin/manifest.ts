import fs from 'node:fs/promises';
import { ASSET_MANIFEST_PATH, generateAssetManifest } from '../assets.ts';

const manifest = await generateAssetManifest('git');
await fs.writeFile(ASSET_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`Written asset manifest to ${ASSET_MANIFEST_PATH}`);
