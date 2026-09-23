import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { AttachmentBuilder, bold, ContainerBuilder, Events, heading, hideLinkEmbed, hyperlink, MessageFlags, SectionBuilder, SeparatorBuilder, TextDisplayBuilder, ThumbnailBuilder, type MessagePayloadOption } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CommandOrigin } from '../../helper/commands.ts';
import { buildChatCommand, prefixAliases } from '../../helper/commands.ts';
import { ACTIVATION, ADRENALINE, ENERGY, getProfessionEmoji, OVERCAST, RECHARGE, SACRIFICE, UPKEEP } from '../../helper/emoji.ts';
import type { Skill, Skillbar } from '../../lib/skills.ts';
import { formatDescription, getAttributeName, getProfessionColor, getProfessionName, getSkill, getSkillByName, getSkillTypeName, getTitleName, searchSkills, type GameMode } from '../../lib/skills.ts';

const assets = path.join(import.meta.dirname, '../../../assets');

export class SkillCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'skill',
            aliases: prefixAliases(['skill-info']),
            description: 'Shows skill info.'
        });

        const { client } = this.container;

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isAutocomplete()) {
                return;
            }
            if (interaction.commandName !== this.name) {
                return;
            }

            const focus = interaction.options.getFocused(true);
            if (focus.name === 'name') {
                const skills = searchSkills(focus.value);
                await interaction.respond(skills.map(skill => ({
                    name: skill.n,
                    value: `${skill.id}`,
                })));
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
                            .setAutocomplete(true)
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
        const skillId = Number(name);
        const skill = Number.isNaN(skillId)
            ? getSkillByName(name, {
                mode: options.mode
            })
            : getSkill(skillId, {
                mode: options.mode
            });

        if (!skill) {
            return await origin.reply(`Unknown skill ${name}`);
        }

        const payload = await buildPayload(skill, options);

        await origin.reply({
            ...payload,
        });
    }
}

export async function buildPayload(skill: Skill, options: {
    hdIcons: boolean,
    skillbar?: Skillbar,
}) {
    const traits = [];
    if (skill.z?.d) traits.push(`-${skill.z.d} ${UPKEEP}`);
    if (skill.z?.a) traits.push(`${Math.ceil(skill.z.a / 25)} ${ADRENALINE}`);
    if (skill.z?.e) traits.push(`${skill.z.e} ${ENERGY}`);
    if (skill.z?.s) traits.push(`${skill.z.s} ${SACRIFICE}`);
    if (skill.z?.c) traits.push(`${skill.z.c} ${ACTIVATION}`);
    if (skill.z?.r) traits.push(`${skill.z.r} ${RECHARGE}`);
    if (skill.z?.x) traits.push(`${skill.z.x} ${OVERCAST}`);

    const skillInfo = [];

    if (skill.p) {
        skillInfo.push(`${getProfessionEmoji(skill.p)} ${getProfessionName(skill.p)}`);
    }
    if (skill.a) {
        skillInfo.push(getAttributeName(skill.a));
    }
    if (skill.tt) {
        skillInfo.push(getTitleName(skill.tt));
    }
    skillInfo.push(getSkillTypeName(skill));

    const section = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder({
                content: heading(
                    hyperlink(
                        skill.n,
                        hideLinkEmbed(`https://wiki.guildwars.com/wiki/Game_link:skill_${skill.id}`)
                    ), 2)
            }),
            new TextDisplayBuilder({
                content: traits.join('\u2003')
            }),
            new TextDisplayBuilder({
                content: [
                    '\u3164',
                    skillInfo.join('\u2003'),
                ].join('\n')
            }),
        );

    const content = new ContainerBuilder()
        .setAccentColor(parseInt(getProfessionColor(skill.p).substring(1), 16))
        .addSectionComponents(
            section
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder({
                content: formatDescription(skill, options.skillbar),
            }),
            new TextDisplayBuilder({
                content: bold('Concise description'),
            }),
            new TextDisplayBuilder({
                content: formatDescription(skill, options.skillbar, true),
            }),
        );

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
    }

    return {
        components: [content],
        flags: MessageFlags.IsComponentsV2,
        files,
    } satisfies MessagePayloadOption;
}
