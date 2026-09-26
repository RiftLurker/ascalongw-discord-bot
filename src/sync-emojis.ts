import { isAfter } from 'date-fns';
import type { Client } from 'discord.js';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import skills from '../assets/skills.json' with { type: 'json' };
import { isNonNullable } from './helper/types.ts';
import { getSkillEmojiName } from './lib/emoji.ts';
import { getSkill, TEMPLATE_LOADABLE_SKILLS } from './lib/skills.ts';

const ASSET_DIR = path.join(import.meta.dirname, '..', 'assets');
const EMOJI_DIR = path.join(ASSET_DIR, 'emojis');
const PROFESSION_DIR = path.join(ASSET_DIR, 'professions');
const SKILL_DIR = path.join(ASSET_DIR, 'skills');

const git = simpleGit();

const { installed: gitInstalled } = await git.version();

export async function syncApplicationEmojis(client: Client<true>) {
    console.log('Synchronizing Application Emojis');
    const existingEmojis = await client.application.emojis.fetch();
    const existingEmojisByName = new Map(existingEmojis.map((emoji) => [emoji.name, emoji]));
    const uncheckedEmojiIds = new Set(existingEmojis.map(emoji => emoji.id));

    const stats = {
        updated: 0,
        created: 0,
        deleted: 0,
    };

    async function handleEmojiFile(file: string, cwd: string, options?: {
        emojiName?: string
    }) {
        const emojiName = options?.emojiName ?? path.parse(file).name;
        const emojiPath = path.join(cwd, file);

        const emoji = existingEmojisByName.get(emojiName);

        if (emoji) {
            uncheckedEmojiIds.delete(emoji.id);

            const lastChanged = await getLastChangedDate(emojiPath);

            if (isAfter(emoji.createdAt, lastChanged)) {
                return;
            }
            await client.application.emojis.delete(emoji);
            stats.updated++;
        }
        else {
            stats.created++;
        }

        await client.application.emojis.create({
            name: emojiName,
            attachment: emojiPath,
        });
    }

    const emojiFiles = await glob('**/*.{jpg,jpeg,png,gif,webp,avif}', {
        cwd: EMOJI_DIR
    });
    const professionFiles = await glob('**/*.{jpg,jpeg,png,gif,webp,avif}', {
        cwd: PROFESSION_DIR
    });

    await Promise.all([
        ...emojiFiles.map(file => handleEmojiFile(file, EMOJI_DIR)),
        ...professionFiles.map(file => handleEmojiFile(file, PROFESSION_DIR)),
    ]);

    const uploadedFileIds = new Map<number, string>();
    await Promise.all(
        Object.values(skills)
            .filter(isNonNullable)
            .map(async skillData => {
                if (!TEMPLATE_LOADABLE_SKILLS.includes(skillData.id)) {
                    return;
                }
                const skill = getSkill(skillData.id, {
                    // force PvE for the clean name and to prevent duplicates
                    mode: 'PvE',
                });
                if (!skill) {
                    return;
                }
                const fileId = skill.i.d;
                if (!fileId) {
                    return;
                }
                if (uploadedFileIds.has(fileId)) {
                    console.warn('File', fileId, 'has already been uploaded as ', uploadedFileIds.get(fileId));
                    return;
                }

                const name = getSkillEmojiName(skill);
                await handleEmojiFile(`${fileId}.png`, SKILL_DIR, {
                    emojiName: name,
                });
                uploadedFileIds.set(fileId, name);
            }));

    for (const uncheckedEmojiId of uncheckedEmojiIds) {
        const emoji = existingEmojis.get(uncheckedEmojiId);

        if (!emoji) {
            continue;
        }
        stats.deleted++;
        await client.application.emojis.delete(emoji);
    }

    console.log(`Emojis synchronized (${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted)`);
}

/**
 * This only uses the file system's modified time if the file was not changed in git
 */
async function getLastChangedDate(file: string) {
    if (gitInstalled) {
        const gitLog = await git.log({
            file,
        });
        if (gitLog.latest) {
            return new Date(Date.parse(gitLog.latest.date));
        }
    }

    return (await fs.stat(file)).mtime;
}
