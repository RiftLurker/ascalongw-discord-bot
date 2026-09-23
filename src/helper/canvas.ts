import { container } from '@sapphire/framework';
import fs from 'fs';
import streams from 'memory-streams';
import { join } from 'path';
import * as pureimage from 'pureimage';
import type { Bitmap } from 'pureimage/dist/bitmap.js';
import type { Skill } from '../lib/skills.ts';
import { getSkillIcon } from '../lib/skills.ts';

const ASSETS = join(import.meta.dirname, '../../assets');

const ELITE_BORDER = loadImage(join(ASSETS, 'elite_border.png'));

export function loadImage(path: string) {
    container.logger.debug('loading image ' + path);
    if (/\.png$/i.exec(path)) {
        return pureimage.decodePNGFromStream(fs.createReadStream(path));
    }
    return pureimage.decodeJPEGFromStream(fs.createReadStream(path));
}

export function createCanvas(width: number, height: number) {
    const canvas = pureimage.make(width, height);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    // canvas.toBuffer = canvasToBuffer;
    return canvas;
}

export async function canvasToBuffer(canvas: Bitmap) {
    // Write method
    const writer = new streams.WritableStream();

    await pureimage.encodePNGToStream(canvas, writer);

    return writer.toBuffer();
}

export const ICON_SKILL_SIZE = 64;

export async function drawSkill(
    ctx: pureimage.Context,
    skillData: NonNullable<Skill>,
    dx: number,
    dy: number,
    {
        hdIcons = false,
        withBorder = true,
    }: {
        hdIcons?: boolean,
        withBorder?: boolean,
    } = {
        hdIcons: false,
        withBorder: true,
    }) {
    const icon = getSkillIcon(skillData, { hdIcons });
    if (!icon) {
        return;
    }
    const image = await loadImage(join(ASSETS, 'skills', `${icon}.png`));
    ctx.drawImage(image, 0, 0, image.width, image.width, dx, dy, ICON_SKILL_SIZE, ICON_SKILL_SIZE);

    if (withBorder && skillData.e) {
        ctx.drawImage(await ELITE_BORDER, dx, dy, ICON_SKILL_SIZE, ICON_SKILL_SIZE);
    }
}
