import type { Args } from '@sapphire/framework';
import { Command, container } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { ActionRowBuilder, AttachmentBuilder, bold, ButtonBuilder, ButtonStyle, ContainerBuilder, EmbedBuilder, hideLinkEmbed, hyperlink, MessageFlags, messageLink, SectionBuilder, SeparatorBuilder, TextDisplayBuilder, ThumbnailBuilder, type MessagePayloadOption } from 'discord.js';
import Fuse from 'fuse.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import skills from '../../../assets/skills.json' with { type: 'json' };
import type { CommandOrigin } from '../../helper/commands.ts';
import { buildChatCommand, prefixAliases } from '../../helper/commands.ts';
import { ACTIVATION, ADRENALINE, ENERGY, getProfessionEmoji, OVERCAST, RECHARGE, SACRIFICE, UPKEEP } from '../../helper/emoji.ts';
import type { Skill } from '../../lib/skills.ts';
import { formatDescription, getAttributeName, getProfessionColor, getProfessionName, getSkill, getSkillTypeName, getTitleName, type GameMode } from '../../lib/skills.ts';

const assets = path.join(import.meta.dirname, '../../../assets');

export class SkillCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'skill',
            aliases: prefixAliases(['skill-info']),
            description: 'Shows skill info.'
        });

        const { client } = container;

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.on('interactionCreate', async (interaction) => {
            if (interaction.isButton()) {
                const match = /^skill-(.*):(.*)/.exec(interaction.customId);
                if (!match) {
                    return;
                }
                const mode = match[1];
                if (mode !== 'PvE' && mode !== 'PvP') {
                    return;
                }
                const skillId = parseInt(match[2]);
                const skill = getSkill(skillId);
                if (!skill) {
                    if (skillId === 0) {
                        await interaction.reply({
                            content: 'This skill slot is empty',
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    return;
                }

                const payload = await buildPayload(skill, {
                    mode: mode,
                    hdIcons: false,
                });

                const message = interaction.message;

                const isEphemeral = message.flags.has(MessageFlags.Ephemeral);

                if (isEphemeral || !message.editable) {
                    await interaction.reply({
                        ...payload,
                        components: [
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setLabel('Back to skillbar')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(messageLink(message.channelId, message.id))
                                )
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                else {
                    console.log(message.embeds[0]);
                    console.log(...message.attachments.values());
                    await interaction.deferUpdate();
                    await message.edit({
                        embeds: [message.embeds[0], ...payload.embeds],
                        files: [...message.attachments.values(), ...payload.files],
                    });
                }
            }
        });
    }

    public registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            buildChatCommand(this, (builder) => (
                builder
                    .addStringOption((option) => (
                        option
                            .setName('name')
                            .setDescription('The skill you want to show')
                            .setRequired(true)
                    ))
                    .addBooleanOption(option => (
                        option
                            .setName('pvp')
                            .setDescription('Show the PvP version')
                    ))
                    .addBooleanOption(option => (
                        option
                            .setName('hd-icons')
                            .setDescription('Use the HD icon')
                    ))
            ))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.execute(interaction,
            interaction.options.getString('name', true),
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

    public async execute(origin: CommandOrigin, name: string, options: {
            mode: GameMode,
            hdIcons: boolean,
        }) {
        const skill = getSkillByName(name);

        if (!skill) {
            return await origin.reply(`Unknown skill ${name}`);
        }

        const payload = await buildPayload(skill, options);

        await origin.reply({
            ...payload,
        });
    }
}

async function buildPayload(skill: Skill, options: {
    mode: GameMode,
    hdIcons: boolean,
}) {
    const skillInfo = [];
    if (skill.z?.d) skillInfo.push(`-${skill.z.d} ${UPKEEP}`);
    if (skill.z?.a) skillInfo.push(`${Math.ceil(skill.z.a / 25)} ${ADRENALINE}`);
    if (skill.z?.e) skillInfo.push(`${skill.z.e} ${ENERGY}`);
    if (skill.z?.s) skillInfo.push(`${skill.z.s} ${SACRIFICE}`);
    if (skill.z?.c) skillInfo.push(`${skill.z.c} ${ACTIVATION}`);
    if (skill.z?.r) skillInfo.push(`${skill.z.r} ${RECHARGE}`);
    if (skill.z?.x) skillInfo.push(`${skill.z.x} ${OVERCAST}`);

    const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder()
            .setContent(
                hideLinkEmbed(
                    hyperlink(
                        skill.n,
                        `https://wiki.guildwars.com/wiki/Game_link:skill_${skill.id}`
                    ))
            ));

    const container = new ContainerBuilder()
        .addSectionComponents(
            section
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(formatDescription(skill)),
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(bold('Concise description')),
            new TextDisplayBuilder().setContent(formatDescription(skill, undefined, true))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(skillInfo.join('\u2003')));


    const embed = new EmbedBuilder()
        .setTitle(skill.n)
        .setURL(`https://wiki.guildwars.com/wiki/Game_link:skill_${skill.id}`)
        .setDescription([
            formatDescription(skill, undefined),
            '',
            bold('Concise description'),
            formatDescription(skill, undefined, true),
            '',
            skillInfo.join('\u2003'),
            '\u3164',
        ].join('\n'))
        .setColor(getProfessionColor(skill.p));

    const fileId = options.hdIcons ? skill.i.h : skill.i.d ?? skill.i.h;

    let files: NonNullable<MessagePayloadOption['files']> = [];

    if (fileId) {
        const fileName = `${fileId}.png`;
        const attachment = new AttachmentBuilder(await fs.readFile(path.join(assets, 'skills', fileName)), {
            name: fileName,
            title: skill.n,
        });
        files = [attachment];
        section.setThumbnailAccessory(new ThumbnailBuilder()
            .setURL(`attachment://${fileName}`));
        embed.setThumbnail(`attachment://${fileName}`);
    }


    embed.setFields([
        ...(skill.p ? [{
            name: 'Profession',
            value: `${getProfessionEmoji(skill.p)} ${getProfessionName(skill.p)}`,
            inline: true,
        }] : []),
        ...(skill.a ? [{
            name: 'Attribute',
            value: getAttributeName(skill.a),
            inline: true,
        }] : []),
        ...(skill.tt ? [{
            name: 'Title',
            value: getTitleName(skill.tt),
            inline: true,
        }] : []),
        ...(skill.t ? [{
            name: 'Type',
            value: getSkillTypeName(skill),
            inline: true,
        }] : []),
    ]);


    return {
        // components: [container],
        embeds: [embed],
        // flags: MessageFlags.IsComponentsV2,
        files,
    } satisfies MessagePayloadOption;
}

const fuse = new Fuse(Object.values(skills).map(skill => skill), {
    keys: ['n'],
    threshold: 0.3,
});

export function getSkillByName(name: string, options: {
  mode: GameMode
} = {
    mode: 'PvE',
}): Skill | null {
    const matches = fuse.search(name);
    if (matches.length === 0) {
        return null;
    }
    return getSkill(matches[0].item.id, options);
}
