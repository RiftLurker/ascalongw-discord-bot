import type { Skill } from './skills.ts';
import { Title } from './skills.ts';

export function sanitizeNameForEmoji(name: string) {
    return name.replaceAll(' ', '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export function getSkillEmojiName(skill: Skill) {
    let name = skill.n;

    switch (skill.t) {
    /* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
    case Title.KurzickRank:
        name += ' (Kurzick)';
        break;
    case Title.LuxonRank:
        name += ' (Luxon)';
        break;
    }
    /* eslint-ensable @typescript-eslint/no-unsafe-enum-comparison */

    return sanitizeNameForEmoji(name);
}
