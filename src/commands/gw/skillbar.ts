import { Args, Command, container } from '@sapphire/framework';
import { ActionRowBuilder, AttachmentBuilder, ChannelType, Message, MessagePayloadOption, StringSelectMenuBuilder, inlineCode } from 'discord.js';
import { ICON_SKILL_SIZE, canvasToBuffer, createCanvas, drawSkill } from '../../helper/canvas';
import { GameMode, Skillbar, decodeTemplate } from '../../lib/skills';

import {
    Attribute,
    formatDescription,
    getAttributeName,
    getProfessionAbbreviation,
    getProfessionName, getSkill,
    getSkillTypeName,
    getTitleName
} from '../../lib/skills';

import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import {
    ACTIVATION,
    ADRENALINE,
    DIGITS,
    ENERGY,
    OVERCAST,
    PLAYER_VS_PLAYER,
    PROFESSION,
    RECHARGE,
    REFORGED_MODE,
    SACRIFICE,
    TEMPLATE,
    UPKEEP
} from '../../helper/emoji';
import { isNonNullable } from '../../helper/types';

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
            if (index === -1) return console.log('invalid emoji');

            const mode = message.content?.includes(PLAYER_VS_PLAYER) ? 'PvP' : 'PvE';
            const hdIcons = message.content?.includes(REFORGED_MODE);

            try {
                const payload = await buildPayload(skillbar, {
                    displayedSkillIndex: index - 1,
                    withInteraction: false,
                    mode,
                    hdIcons,
                });
                await message.edit(payload);
                if (message.channel.type !== ChannelType.DM) {
                    await reaction.users.remove(user.id);
                }
            }
            catch (e) {
                // ignore errors
            }
        });

        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isStringSelectMenu()) {
                return;
            }
            const match = interaction.customId.match(/^skillbar-(.*)$/);
            if (!match) {
                return;
            }
            const template = match[1];
            const skillIndex = +interaction.values[0];

            const skillbar = decodeTemplate(template);
            if (!skillbar) {
                interaction.reply({
                    content: `${inlineCode(template)} is not a valid skill template`,
                    ephemeral: true,
                });
                return;
            }

            const { message } = interaction;

            const mode = message.content?.includes(PLAYER_VS_PLAYER) ? 'PvP' : 'PvE';
            const hdIcons = message.content?.includes(REFORGED_MODE);

            const payload = await buildPayload(skillbar, {
                displayedSkillIndex: skillIndex,
                withInteraction: true,
                mode: mode as GameMode,
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

        const skillbar = decodeTemplate(template);
        if (!skillbar) {
            return origin.reply({
                content: `${inlineCode(template)} is not a valid skill template`,
                ephemeral: true,
            });
        }

        const payload = await buildPayload(skillbar, {
            withInteraction: isEphemeral,
            mode: options.mode,
            hdIcons: options.hdIcons,
        });
        const response = await origin.reply({
            ...payload,
            ephemeral: isEphemeral,
        });

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

async function buildPayload(skillbar: Skillbar, options: {
    withInteraction: boolean,
    displayedSkillIndex?: number,
    hdIcons?: boolean,
    mode: GameMode,
}) {
    const canvas = createCanvas(8 * IMAGE_SIZE, IMAGE_SIZE);
    const ctx = canvas.getContext('2d');

    await Promise.all(skillbar.skills
        .map((skillId) => {
            return getSkill(skillId, { mode: options.mode });
        })
        .map((skill, skillIndex) => {
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

    const components = options.withInteraction
        ? [
            new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`skillbar-${skillbar.template}`)
                        .setPlaceholder('Skill Info')
                        .addOptions(
                            ...(skillbar.skills.map((skillId, index) => {
                                const skill = getSkill(skillId, {
                                    mode: options.mode,
                                });

                                if (!skill) {
                                    return null;
                                }

                                return {
                                    label: skill?.n,
                                    value: `${index}`,
                                    emoji: DIGITS[index + 1],
                                };
                            }).filter(isNonNullable))
                        )
                )
        ]
        : [];

    return {
        content,
        files: [attachment],
        components,
    } satisfies MessagePayloadOption;
}

function buildSkillbarContent(skillbar: Skillbar, options: {
    shownSkillIndex?: number,
    mode: GameMode
    hdIcons?: boolean,
}) {
    const primary = `${PROFESSION.get(skillbar.primary)} ${getProfessionAbbreviation(skillbar.primary)}`;
    const secondary = `${getProfessionAbbreviation(skillbar.secondary)} ${PROFESSION.get(skillbar.secondary)}`;

    const listAttributes = (attributes: Skillbar['attributes']) => {
        const arr = [];
        for (const attribute in attributes) {
            const attr: Attribute = attribute as unknown as Attribute;
            arr.push(`${getAttributeName(attr)}: **${skillbar.attributes[attr]}**`);
        }
        return arr;
    };
    return [
        `${primary} / ${secondary} -- \`${skillbar.template}\` -- ${TEMPLATE}${options.hdIcons ? ` ${REFORGED_MODE}` : ''}`,
        ...(options.mode === 'PvP'
            ? [`This is a ${PLAYER_VS_PLAYER} PvP build.`]
            : []
        ),
        listAttributes(skillbar.attributes).join(' '),
        ' ',
        ...(options.shownSkillIndex == null
            ? []
            : buildSkillInfoContent(skillbar, options.shownSkillIndex, {
                mode: options.mode,
            })
        )
    ].join('\n');
}

function buildSkillInfoContent(skillbar: Skillbar, skillIndex: number, options: {
    mode: GameMode
}) {
    const skillId = skillbar.skills[skillIndex];
    const skillData = getSkill(skillId, {
        mode: options.mode
    });
    if(!skillData) {
        throw new Error(`Unable to find skill data for skill **${skillId}**`);
    }

    const skillInfo = [];
    if (skillData?.z?.d) skillInfo.push(`-${skillData.z.d} ${UPKEEP}`);
    if (skillData?.z?.a) skillInfo.push(`${skillData.z.a} ${ADRENALINE}`);
    if (skillData?.z?.e) skillInfo.push(`${skillData.z.e} ${ENERGY}`);
    if (skillData?.z?.s) skillInfo.push(`${skillData.z.s} ${SACRIFICE}`);
    if (skillData?.z?.c) skillInfo.push(`${skillData.z.c} ${ACTIVATION}`);
    if (skillData?.z?.r) skillInfo.push(`${skillData.z.r} ${RECHARGE}`);
    if (skillData?.z?.x) skillInfo.push(`${skillData.z.x} ${OVERCAST}`);
    if (skillData?.p && getProfessionName(skillData.p)) skillInfo.push(`Prof: **${getProfessionName(skillData.p)}**`);
    if (skillData?.a && getAttributeName(skillData.a)) skillInfo.push(`Attrb: **${getAttributeName(skillData.a)}**`);
    if (skillData?.tt && getTitleName(skillData.tt)) skillInfo.push(`Title: **${getTitleName(skillData.tt)}**`);
    if (skillData?.t && getSkillTypeName(skillData)) skillInfo.push(`Type: **${getSkillTypeName(skillData)}**`);

    const skillDescription = skillData
        ? [
            `Skill ${skillIndex + 1}: **${skillData.n}** -- [Guild Wars Wiki](<https://wiki.guildwars.com/wiki/Game_link:skill_${skillData.id}>)`,
            `> ${getSkillTypeName(skillData)}. ${formatDescription(skillData, skillbar)}`
        ]
        : [
            `Skill ${skillIndex + 1}: _empty_`
        ];

    return [
        ...skillDescription,
        '',
        skillInfo.join(' ')
    ];
}
