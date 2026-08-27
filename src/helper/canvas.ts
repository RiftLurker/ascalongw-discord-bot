import fs from 'fs';
import streams from 'memory-streams';
import { join } from 'path';
import * as pureimage from 'pureimage';
import { Bitmap } from 'pureimage/dist/bitmap.js';
import { getSkillIcon, Skill } from '../lib/skills';

const ASSETS = join(__dirname, '../../assets');

export function loadImage(path: string) {
    console.log('loading image ' + path);
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
export const ICON_SKILL_SIZE_HD = 128;

export async function drawSkill(
    ctx: pureimage.Context,
    skillData: NonNullable<Skill>,
    dx: number,
    dy: number,
    { hdIcons = false }: {
  hdIcons?: boolean
} = { hdIcons: false }) {
    const icon = getSkillIcon(skillData, { hdIcons });
    if (!icon) {
        return;
    }
    const image = await loadImage(join(ASSETS, 'skills', `${icon}.png`));

    if (hdIcons) {
        ctx.drawImage(image, 0, 0, ICON_SKILL_SIZE_HD, ICON_SKILL_SIZE_HD, dx, dy, ICON_SKILL_SIZE, ICON_SKILL_SIZE);
    }
    else {
        ctx.drawImage(image, dx, dy, ICON_SKILL_SIZE, ICON_SKILL_SIZE);
    }
}
