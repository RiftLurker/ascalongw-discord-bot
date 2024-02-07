import fs from 'fs';
import streams from 'memory-streams';
import * as pureimage from 'pureimage';
import { Bitmap } from 'pureimage/dist/bitmap.js';

export function loadImage(path: string) {
    console.log('loading image ' + path);
    if (/\.png$/i.exec(path)) {
        return pureimage.decodePNGFromStream(fs.createReadStream(path));
    }
    return pureimage.decodeJPEGFromStream(fs.createReadStream(path));
}
export function createCanvas(width: number, height: number) {
    const canvas = pureimage.make(width, height);
    // canvas.toBuffer = canvasToBuffer;
    return canvas;
}
export async function canvasToBuffer(canvas: Bitmap) {
    // Write method
    const writer = new streams.WritableStream();

    await pureimage.encodePNGToStream(canvas, writer);

    return writer.toBuffer();
}