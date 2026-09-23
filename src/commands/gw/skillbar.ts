import type { Args } from '@sapphire/framework';
import { Command, container } from '@sapphire/framework';
import type { MessagePayloadOption } from 'discord.js';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Message, inlineCode } from 'discord.js';
import { ICON_SKILL_SIZE, canvasToBuffer, createCanvas, drawSkill } from '../../helper/canvas.ts';
import type { GameMode, Skillbar } from '../../lib/skills.ts';
import { decodeTemplate, getProfessionColor } from '../../lib/skills.ts';

import type {
    Attribute
} from '../../lib/skills.ts';
import {
    formatDescription,
    getAttributeName,
    getProfessionAbbreviation,
    getProfessionName, getSkill,
    getSkillTypeName,
    getTitleName
} from '../../lib/skills.ts';

import type { CommandOrigin } from '../../helper/commands.ts';
import { allowsReactions, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands.ts';
import {
    ACTIVATION,
    ADRENALINE,
    DIGITS,
    ENERGY,
    OVERCAST,
    PLAYER_VS_PLAYER,
    RECHARGE,
    REFORGED_MODE,
    SACRIFICE,
    UPKEEP,
    getEmojiByName,
    getProfessionEmoji,
    getSkillEmoji
} from '../../helper/emoji.ts';

const IMAGE_SIZE = 64;

export class SkillbarCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'skillbar',
            aliases: prefixAliases(['s', 'build']),
            description: 'Previews a skill template.'
        });

        const { client } = container;

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.on('messageReactionAdd', async (reaction, user) => {
            if (reaction.partial) {
                await reaction.fetch();
            }

            const message = reaction.message;
            if (message.partial) {
                await message.fetch();
            }

            if (!client.user || message.author?.id !== client.user.id) return;
            if (user.id === client.user.id) return;

            const template = message.content?.match(/-- `([^`]+)` --/);
            if (!template) return console.log('no template found');

            const skillbar = decodeTemplate(template[1]);
            if (!skillbar) return console.log('no skillbar decoded');

            const index = DIGITS.indexOf(reaction.emoji.name ?? '');
            if (index === -1) return console.log('invalid emoji', reaction.emoji.name);

            const mode = message.content?.includes(PLAYER_VS_PLAYER.toString()) ? 'PvP' : 'PvE';
            const hdIcons = message.content?.includes(REFORGED_MODE.toString());

            try {
                const payload = await buildPayload(skillbar, {
                    displayedSkillIndex: index - 1,
                    withInteraction: false,
                    mode,
                    hdIcons,
                });
                await message.edit(payload);
                // FIXME Permission check
                if (message.channel.type !== ChannelType.DM) {
                    await reaction.users.remove(user.id);
                }
            }
            catch {
                // ignore errors
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isStringSelectMenu()) {
                return;
            }
            const match = /^skillbar-(.*)$/.exec(interaction.customId);
            if (!match) {
                return;
            }
            const template = match[1];
            const skillIndex = +interaction.values[0];

            const skillbar = decodeTemplate(template);
            if (!skillbar) {
                return await interaction.reply({
                    content: `${inlineCode(template)} is not a valid skill template`,
                    ephemeral: true,
                });
            }

            const { message } = interaction;

            const mode = message.content.includes(PLAYER_VS_PLAYER.toString()) ? 'PvP' : 'PvE';
            const hdIcons = message.content.includes(REFORGED_MODE.toString());

            const payload = await buildPayload(skillbar, {
                displayedSkillIndex: skillIndex,
                withInteraction: true,
                mode: mode,
                hdIcons,
            });

            await interaction.reply({
                ...payload,
                ephemeral: true,
            });
        });
    }

    public registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            buildChatCommand(this, (builder) => (
                builder
                    .addStringOption((option) => (
                        option
                            .setName('template')
                            .setDescription('The skillbar template to display')
                            .setRequired(true)
                    ))
                    .addBooleanOption(option => (
                        option
                            .setName('pvp')
                            .setDescription('This skillbar is intended for PvP')
                    ))
                    .addBooleanOption(option => (
                        option
                            .setName('hd-icons')
                            .setDescription('Use HD icons')
                    ))
            ))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.execute(interaction,
            interaction.options.getString('template', true),
            {
                mode: interaction.options.getBoolean('pvp') ? 'PvP' : 'PvE',
                hdIcons: interaction.options.getBoolean('hd-icons') ?? false,
            },
        );
    }

    public async messageRun(message: Message, args: Args) {
        return this.execute(message, await args.pick('string'), {
            mode: args.getFlags('pvp') ? 'PvP' : 'PvE',
            hdIcons: args.getFlags('hd-icons'),
        });
    }

    public async execute(origin: CommandOrigin, template: string, options: {
        mode: GameMode,
        hdIcons: boolean,
    }) {
        const isEphemeral = isEphemeralCommand(origin, false);
        const usesReactions = isEphemeral || allowsReactions(origin);

        const skillbar = decodeTemplate(template);
        if (!skillbar) {
            return origin.reply({
                content: `${inlineCode(template)} is not a valid skill template`,
                ephemeral: true,
            });
        }

        const payload = await buildPayload(skillbar, {
            withInteraction: !usesReactions,
            mode: options.mode,
            hdIcons: options.hdIcons,
        });
        const response = await origin.reply({
            ...payload,
            ephemeral: isEphemeral,
        });

        if (usesReactions) {
            const message = response instanceof Message
                ? response
                : !isEphemeral && await response.fetch();

            if (message) {
                for (let i = 0; i < skillbar.skills.length; i++) {
                    await message.react(DIGITS[i + 1]);
                }
            }
        }
    }
}

async function buildPayload(skillbar: Skillbar, options: {
    withInteraction: boolean,
    displayedSkillIndex?: number,
    hdIcons?: boolean,
    mode: GameMode,
}) {
    const canvas = createCanvas(8 * IMAGE_SIZE, IMAGE_SIZE);
    const ctx = canvas.getContext('2d');

    await Promise.all(
        skillbar.skills.map((skillId, skillIndex) => {
            const skill = getSkill(skillId, { mode: options.mode });
            if (!skill) {
                return;
            }
            return drawSkill(
                ctx,
                skill,
                skillIndex * ICON_SKILL_SIZE,
                0,
                {
                    hdIcons: options.hdIcons
                }
            );
        })
    );

    const attachment = new AttachmentBuilder(await canvasToBuffer(canvas), {
        name: `${skillbar.template}.png`,
    });

    const content = buildSkillbarContent(skillbar, {
        shownSkillIndex: options.displayedSkillIndex,
        mode: options.mode,
        hdIcons: options.hdIcons,
    });

    function createSkillButton(skillId: number) {
        const button = new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`skill-${options.mode}:${skillId}`);

        if (skillId !== 0) {
            button.setEmoji(getSkillEmoji(skillId).identifier);
        }
        else {
            button.setEmoji(getEmojiByName('empty').identifier);
        }

        return button;
    }

    const components = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...skillbar.skills.slice(0, 4).map(createSkillButton),
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...skillbar.skills.slice(4, 8).map(createSkillButton),
        ),
    ];

    content.setImage(`attachment://${skillbar.template}.png`);

    return {
        embeds: [content.toJSON()],
        // content,
        files: [attachment],
        components,
    } satisfies MessagePayloadOption;
}

function buildSkillbarContent(skillbar: Skillbar, options: {
    shownSkillIndex?: number,
    mode: GameMode
    hdIcons?: boolean,
}) {
    const primary = `${getProfessionEmoji(skillbar.primary)} ${getProfessionAbbreviation(skillbar.primary)}`;
    const secondary = `${getProfessionAbbreviation(skillbar.secondary)} ${getProfessionEmoji(skillbar.secondary)}`;

    const embed = new EmbedBuilder()
        .setTitle(`${primary} / ${secondary}`)
        .setColor(getProfessionColor(skillbar.primary))
        .setFields(
            {
                name: 'Template',
                value: skillbar.template
            },
            ...(options.mode === 'PvP' ? [
                {
                    name: 'PvP',
                    value: 'Yes',
                },
            ] : []),
            ...Object.entries(skillbar.attributes).map(([attribute, level]) => ({
                name: getAttributeName(attribute as unknown as Attribute),
                value: String(level),
                inline: true,
            }))
        );

    return embed;

    // const listAttributes = (attributes: Skillbar['attributes']) => {
    //     const arr = [];
    //     for (const attribute in attributes) {
    //         const attr: Attribute = attribute as unknown as Attribute;
    //         arr.push(`${getAttributeName(attr)}: **${skillbar.attributes[attr]}**`);
    //     }
    //     return arr;
    // };

    // return [
    //     `${primary} / ${secondary} -- \`${skillbar.template}\` -- ${TEMPLATE}${options.hdIcons ? ` ${REFORGED_MODE}` : ''}`,
    //     ...(options.mode === 'PvP'
    //         ? [`This is a ${PLAYER_VS_PLAYER} PvP build.`]
    //         : []
    //     ),
    //     listAttributes(skillbar.attributes).join(' '),
    //     ' ',
    //     ...(options.shownSkillIndex == null
    //         ? []
    //         : buildSkillInfoContent(skillbar, options.shownSkillIndex, {
    //             mode: options.mode,
    //         })
    //     )
    // ].join('\n');
}

function buildSkillInfoContent(skillbar: Skillbar, skillIndex: number, options: {
    mode: GameMode
}) {
    const skillId = skillbar.skills[skillIndex];
    const skillData = getSkill(skillId, {
        mode: options.mode
    });
    if(!skillData) {
        return [
            `Skill ${skillIndex + 1}: _empty_`
        ];
    }

    const skillInfo = [];
    if (skillData.z?.d) skillInfo.push(`-${skillData.z.d} ${UPKEEP}`);
    if (skillData.z?.a) skillInfo.push(`${skillData.z.a} ${ADRENALINE}`);
    if (skillData.z?.e) skillInfo.push(`${skillData.z.e} ${ENERGY}`);
    if (skillData.z?.s) skillInfo.push(`${skillData.z.s} ${SACRIFICE}`);
    if (skillData.z?.c) skillInfo.push(`${skillData.z.c} ${ACTIVATION}`);
    if (skillData.z?.r) skillInfo.push(`${skillData.z.r} ${RECHARGE}`);
    if (skillData.z?.x) skillInfo.push(`${skillData.z.x} ${OVERCAST}`);
    if (skillData.p && getProfessionName(skillData.p)) skillInfo.push(`Prof: **${getProfessionName(skillData.p)}**`);
    if (skillData.a && getAttributeName(skillData.a)) skillInfo.push(`Attrb: **${getAttributeName(skillData.a)}**`);
    if (skillData.tt && getTitleName(skillData.tt)) skillInfo.push(`Title: **${getTitleName(skillData.tt)}**`);
    if (skillData.t && getSkillTypeName(skillData)) skillInfo.push(`Type: **${getSkillTypeName(skillData)}**`);

    const skillDescription = [
        `Skill ${skillIndex + 1}: **${skillData.n}** -- [Guild Wars Wiki](<https://wiki.guildwars.com/wiki/Game_link:skill_${skillData.id}>)`,
        `> ${getSkillTypeName(skillData)}. ${formatDescription(skillData, skillbar)}`
    ];

    return [
        ...skillDescription,
        '',
        skillInfo.join(' ')
    ];
}
