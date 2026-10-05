import { glob } from 'glob';
import fs from 'node:fs/promises';
import { join, relative } from 'node:path';
import { simpleGit } from 'simple-git';
import { ASSET_DIR, } from './sync-emojis.ts';

export const ASSET_MANIFEST_PATH = join(import.meta.dirname, '..', 'assets.json');

type AssetManifest = Record<string, number>;

export const git = simpleGit();

export async function generateAssetManifest(source: 'git' | 'fs') {
    if (source === 'git') {
        if (!(await git.version()).installed) {
            throw new Error('git is not installed.');
        }
    }

    const files = await glob('**/*', {
        cwd: ASSET_DIR,
    });

    const manifest: AssetManifest = {};

    async function getChangeDate(file: string): Promise<Date | null> {
        switch (source) {
        case 'git': {
            const gitLog = await git.log({
                file,
            });
            if (gitLog.latest) {
                return new Date(Date.parse(gitLog.latest.date));
            }
            return null;
        }
        case 'fs':
            return (await fs.stat(file)).mtime;
        }
    }

    await Promise.all(files
        .map(async (file) => {
            const path = join(ASSET_DIR, file);
            const change = await getChangeDate(path);
            if (!change) {
                return console.warn(`No change date found for ${path}`);
            }
            const assetPath = relative(ASSET_MANIFEST_PATH, path);
            manifest[assetPath] = change.getTime();
        }));

    return manifest;
}

export async function getAssetManifest(source: 'manifest' | 'git' | 'fs'): Promise<AssetManifest> {
    switch (source) {
    case 'manifest':
        return JSON.parse(await fs.readFile(ASSET_MANIFEST_PATH, 'utf8')) as AssetManifest;
    case 'fs':
    case 'git':
        return generateAssetManifest(source);
    }
}
