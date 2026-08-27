import { Attribute, Profession, Title } from '../src/lib/skills';

declare const data: Record<
    `${number}`,
    {
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
>;

export default data;
