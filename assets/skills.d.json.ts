import { Attribute, Profession, Title } from '../src/lib/skills';

declare const data: (null | {
    n: string,
    d: string;
    cd: string;
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
})[];

export default data;