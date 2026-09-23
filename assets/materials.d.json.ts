import type { Material } from '../src/lib/materials.ts';

declare const materials: Material[];

// @ts-expect-error this fixes some weird .d.json.ts behaviour in ESM https://github.com/microsoft/TypeScript/issues/57229#issuecomment-2287172912
export = materials;

export type { Material };
