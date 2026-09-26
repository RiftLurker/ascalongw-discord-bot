import type { Emoji } from 'discord.js';
import type { Skill } from '../../src/lib/skills.ts';
import { getSkill, Profession, Title } from '../../src/lib/skills.ts';
import { client } from '../index.ts';
import { sanitizeNameForEmoji } from '../lib/emoji.ts';

export const DIGITS = [
    '\u0030\u20E3',
    '\u0031\u20E3',
    '\u0032\u20E3',
    '\u0033\u20E3',
    '\u0034\u20E3',
    '\u0035\u20E3',
    '\u0036\u20E3',
    '\u0037\u20E3',
    '\u0038\u20E3',
    '\u0039\u20E3',
];

export const EDIT = '\uD83D\uDCDD';

let emojiLookupByName = await createEmojiLookup();

async function createEmojiLookup() {
    if (!client.application) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.once('clientReady', refetchEmojis);
        return new Map<string, Emoji>();
    }
    const emojis = await client.application.emojis.fetch();

    return new Map<string, Emoji>(emojis.map((emoji) => [emoji.name, emoji]));
}

export async function refetchEmojis() {
    emojiLookupByName = await createEmojiLookup();
}

export function getEmojiByName(name: string) {
    let emoji = emojiLookupByName.get(name);
    if (!emoji) {
        emoji = emojiLookupByName.get(sanitizeNameForEmoji(name));
        if (!emoji) {
            throw new Error(`Cannot find emoji ${name}`);
        }
    }
    return emoji;
}

export function getSkillEmojiName(skill: Skill) {
    let name = skill.n;

    /* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
    switch (skill.t) {
    case Title.KurzickRank:
        name += ' (Kurzick)';
        break;
    case Title.LuxonRank:
        name += ' (Luxon)';
        break;
    }
    /* eslint-enable @typescript-eslint/no-unsafe-enum-comparison */

    return sanitizeNameForEmoji(name);
}

export function getSkillEmoji(id: number) {
    const skill = getSkill(id, {
        mode: 'PvE',
    });

    if (!skill) {
        throw new Error(`Cannot find skill ${id}`);
    }

    return getEmojiByName(getSkillEmojiName(skill));
}

// TODO init all of these after syncApplicationEmojis

export function getProfessionEmoji(profession: Profession) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return PROFESSION.get(profession)!;
}

const PROFESSION = new Map<Profession, Emoji>([
    [Profession.None, lazyEmoji('None')],
    [Profession.Warrior, lazyEmoji('Warrior')],
    [Profession.Ranger, lazyEmoji('Ranger')],
    [Profession.Monk, lazyEmoji('Monk')],
    [Profession.Necromancer, lazyEmoji('Necromancer')],
    [Profession.Mesmer, lazyEmoji('Mesmer')],
    [Profession.Elementalist, lazyEmoji('Elementalist')],
    [Profession.Assassin, lazyEmoji('Assassin')],
    [Profession.Ritualist, lazyEmoji('Ritualist')],
    [Profession.Paragon, lazyEmoji('Paragon')],
    [Profession.Dervish, lazyEmoji('Dervish')],
]);

export const TEMPLATE = lazyEmoji('template');
export const ADRENALINE = lazyEmoji('adrenaline');
export const ENERGY = lazyEmoji('energy');
export const SACRIFICE = lazyEmoji('sacrifice');
export const ACTIVATION = lazyEmoji('activation');
export const RECHARGE = lazyEmoji('recharge');
export const OVERCAST = lazyEmoji('overcast');
export const UPKEEP = lazyEmoji('upkeep');

export const GOLD = lazyEmoji('gold');
export const PLATINUM = lazyEmoji('platinum');

export const GIFT_OF_THE_HUNTSMAN = lazyEmoji('Gift_of_the_Huntsman');

export const ZAISHEN_COPPER_COIN = lazyEmoji('Zaishen_Copper_Coin');

export const VANGUARD_INITIATE = lazyEmoji('Vanguard_Initiate');

export const REFORGED_MODE = lazyEmoji('Reforged_Mode');
export const MELANDRUS_ACCORD = lazyEmoji('Melandrus_Accord');
export const DHUUM_COVENANT = lazyEmoji('Dhuums_Covenant');

export const PLAYER_VS_PLAYER = lazyEmoji('PvP');

function lazyEmoji(name: string): Emoji {
    let target: Emoji | undefined;

    const getTarget = () => {
        return target ??= getEmojiByName(name);
    };

    return new Proxy({} as Emoji, {
        get(_target, property, receiver) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return Reflect.get(getTarget(), property, receiver);
        },
        set(_target, property, value, receiver) {
            return Reflect.set(getTarget(), property, value, receiver);
        },
        has(_target, property) {
            return property in getTarget();
        },
        ownKeys() {
            return Reflect.ownKeys(getTarget());
        },
        getOwnPropertyDescriptor(_target, property) {
            return Reflect.getOwnPropertyDescriptor(getTarget(), property);
        },
        getPrototypeOf(_target) {
            return Reflect.getPrototypeOf(getTarget());
        }
    });
}
