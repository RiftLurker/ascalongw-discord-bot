import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import type { MessagePayloadOption } from 'discord.js';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, Message, MessageFlags, SeparatorBuilder, TextDisplayBuilder, bold, heading, inlineCode } from 'discord.js';
import { ICON_SKILL_SIZE, canvasToBuffer, createCanvas, drawSkill } from '../../helper/canvas.ts';
import type { Attribute, GameMode, Skillbar } from '../../lib/skills.ts';
import { decodeTemplate, getProfessionColor } from '../../lib/skills.ts';

import {
    getAttributeName,
    getProfessionAbbreviation,
    getSkill
} from '../../lib/skills.ts';

import type { CommandOrigin } from '../../helper/commands.ts';
import { allowsReactions, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands.ts';
import {
    DIGITS,
    PLAYER_VS_PLAYER,
    REFORGED_MODE,
    getEmojiByName,
    getProfessionEmoji,
    getSkillEmoji
} from '../../helper/emoji.ts';
import { extractAttachmentIds } from '../../lib/component.ts';
import { buildPayload as buildSkillPayload } from './skill.ts';

const IMAGE_SIZE = 64;

export class SkillbarCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'skillbar',
            aliases: prefixAliases(['s', 'build']),
            description: 'Previews a skill template.'
        });

        const { client } = this.container;

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
                await message.edit({
                    content: null,
                    ...payload,
                });
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                await Promise.all(DIGITS.map(async digit => message.reactions.resolve(digit)?.users.remove(client.user!)));
                await reaction.users.remove(client.user.id);
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

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) {
                return;
            }
            if (interaction.customId.startsWith('skill-empty')) {
                await interaction.reply({
                    content: 'This skill slot is empty',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            const match = /^skill-(.*):(.*):(.*)/.exec(interaction.customId);
            if (!match) {
                return;
            }
            const mode = match[1];
            if (mode !== 'PvE' && mode !== 'PvP') {
                return;
            }
            const skillId = parseInt(match[2]);
            const skill = getSkill(skillId, {
                mode,
            });
            if (!skill) {
                await interaction.reply({
                    content: `Unable to find skill ${skillId}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            const skillbar = decodeTemplate(match[3]);
            if (!skillbar) {
                return;
            }

            const payload = await buildSkillPayload(skill, {
                hdIcons: false,
                skillbar,
            });

            const message = interaction.message;
            const component = message.components[0];
            const attachmentIds = extractAttachmentIds(component);

            await interaction.update({
                components: [
                    component,
                    new SeparatorBuilder(),
                    ...payload.components.slice(0, -1),
                    payload.components.slice(-1)[0].addActionRowComponents(
                        new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('skillbar-clear')
                                    .setLabel('Hide skill info')
                                    .setStyle(ButtonStyle.Danger)))
                ],
                attachments: attachmentIds.map((id) => ({ id })),
                files: payload.files,
            });
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton() || interaction.customId !== 'skillbar-clear') {
                return;
            }
            const message = interaction.message;

            await interaction.update({
                components: message.components.slice(0, 1),
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
        skillbar.skills.map(async (skillId, skillIndex) => {
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
        name: 'skillbar.png',
    });

    const content = buildSkillbarContent(skillbar, {
        shownSkillIndex: options.displayedSkillIndex,
        mode: options.mode,
        hdIcons: options.hdIcons,
        skillbarUrl: `attachment://${attachment.name}`
    });

    return {
        components: [
            content,
        ],
        flags: MessageFlags.IsComponentsV2,
        files: [attachment],
    } satisfies MessagePayloadOption;
}

function buildSkillbarContent(skillbar: Skillbar, options: {
    shownSkillIndex?: number,
    mode: GameMode
    hdIcons?: boolean,
    skillbarUrl: string;
}) {
    const primary = `${getProfessionEmoji(skillbar.primary)} ${getProfessionAbbreviation(skillbar.primary)}`;
    const secondary = `${getProfessionAbbreviation(skillbar.secondary)} ${getProfessionEmoji(skillbar.secondary)}`;

    const content = new ContainerBuilder()
        .setAccentColor(parseInt(getProfessionColor(skillbar.primary).substring(1), 16))
        .addTextDisplayComponents(
            new TextDisplayBuilder({
                content: heading(`${primary} / ${secondary}`, 2),
            }),
            ...(options.mode === 'PvP'
                ? [new TextDisplayBuilder({
                    content: `This build is intended for PvP ${PLAYER_VS_PLAYER}`,
                })]
                : []),
            new TextDisplayBuilder({
                content: `${bold('Template')}\n${skillbar.template}`,
            }),
            ...(Object.entries(skillbar.attributes).length === 0
                ? []
                : [new TextDisplayBuilder({
                    content: Object.entries(skillbar.attributes)
                        .map(([attributeId, level]) => `${bold(getAttributeName(attributeId as unknown as Attribute))}: ${level}`)
                        .join('\u2003')
                })])
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder()
                .addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(options.skillbarUrl)
                )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder({
                content: 'Click for skill info'
            })
        );

    const skills = skillbar.skills.map((skillId: number, slot: number) => {
        const button = new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary);

        if (skillId !== 0) {
            button
                .setCustomId(`skill-${options.mode}:${skillId}:${skillbar.template}`)
                // TODO Use a fallback emoji for unknown skills instead of failing
                .setEmoji(getSkillEmoji(skillId).identifier);
        }
        else {
            button
                .setCustomId(`skill-empty:${slot}`)
                .setEmoji(getEmojiByName('empty').identifier);
        }

        return button;
    });

    content.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...skills.slice(0, 4),
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...skills.slice(4, 8),
        ),
    );

    return content;
}
