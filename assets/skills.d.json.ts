import type { Attribute, Profession, Title } from '../src/lib/skills.ts';

interface Skill {
    id: number,
    alt?: number,
    n: string;
    d: string;
    cd: string;
    // icon
    i: {
        // default
        d?: number,
        // hi-res
        h?: number,
    },
    t: number;
    p: Profession;
    a?: Attribute;
    tt?: Title;
    e?: 1;
    c: number;
    z?: {
        x?: number;
        r?: number;
        c?: number;
        d?: 1;
        a?: number;
        e?: number;
        s?: number;
        sp?: number;
        co?: number;
        q?: number;
    };
    v?: Partial<Record<'s' | 'b' | 'd', [number, number]>>;
}

declare const data: Record<
    `${number}`,
    Skill | undefined,
>;

// @ts-expect-error this fixes some weird .d.json.ts behaviour in ESM https://github.com/microsoft/TypeScript/issues/57229#issuecomment-2287172912
export = data;
