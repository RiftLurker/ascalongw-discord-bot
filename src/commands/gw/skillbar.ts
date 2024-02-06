import { Args, Command, container } from '@sapphire/framework';
import { ActionRowBuilder, AttachmentBuilder, Message, MessagePayloadOption, StringSelectMenuBuilder, inlineCode } from 'discord.js';
import path from 'node:path';
import { canvasToBuffer, createCanvas, loadImage } from '../../helper/canvas';
import { Skillbar, decodeTemplate } from '../../lib/skills';
const assets = path.join(__dirname, '../../../assets');

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
    PROFESSION,
    RECHARGE,
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
            if (!client.user || message.author?.id !== client.user.id) return;
            if (user.id === client.user.id) return;

            const template = message.content?.match(/-- `([^`]+)` --/);
            if (!template) return console.log('no template found');

            const skillbar = decodeTemplate(template[1]);
            if (!skillbar) return console.log('no skillbar decoded');

            const index = DIGITS.indexOf(reaction.emoji.name ?? '');
            if (index === -1) return console.log('invalid emoji');

            const payload = await buildPayload(skillbar, index - 1);
            await message.edit(payload);
            await reaction.users.remove(user.id);
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

            const payload = await buildPayload(skillbar, skillIndex);

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
                            .setDescription('the skillbar template to display')
                            .setRequired(true)
                    ))
            ))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.execute(interaction, interaction.options.getString('template', true));

        /* REMOVE STUFF BELOW */
        // await attachReactions();
    }

    public async messageRun(message: Message, args: Args) {
        return this.execute(message, await args.pick('string'));
    }

    public async execute(origin: CommandOrigin, template: string) {
        const isEphemeral = isEphemeralCommand(origin, false);

        const skillbar = decodeTemplate(template);
        if (!skillbar) {
            return origin.reply({
                content: `${inlineCode(template)} is not a valid skill template`,
                ephemeral: isEphemeral,
            });
        }

        const payload = await buildPayload(skillbar);
        await origin.reply({
            ...payload,
            ephemeral: isEphemeral,
        });
    }
}

async function buildPayload(skillbar: Skillbar, skillIndex?: number) {
    const canvas = createCanvas(8 * IMAGE_SIZE, IMAGE_SIZE);
    const ctx = canvas.getContext('2d');

    const images = await Promise.all(
        skillbar.skills.map(skillID => loadImage(path.join(assets, 'skills', `${skillID}.jpg`)))
    );
    images.forEach((image, index) => ctx.drawImage(image, index * IMAGE_SIZE, 0, IMAGE_SIZE, IMAGE_SIZE));

    const attachment = new AttachmentBuilder(await canvasToBuffer(canvas), {
        name: `${skillbar.template}.png`,
    });

    const content = buildSkillbarContent(skillbar, skillIndex);

    const components = [
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`skillbar-${skillbar.template}`)
                    .setPlaceholder('Skill Info')
                    .addOptions(
                        ...(skillbar.skills.map((skillId, index) => {
                            const skill = getSkill(skillId);

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
    ];

    return {
        content,
        files: [attachment],
        components,
    } satisfies MessagePayloadOption;
}

function buildSkillbarContent(skillbar: Skillbar, skillIndex?: number) {
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
        `${primary} / ${secondary} -- \`${skillbar.template}\` -- ${TEMPLATE}`,
        listAttributes(skillbar.attributes).join(' '),
        ' ',
        ...(skillIndex == null
            ? []
            : buildSkillInfoContent(skillbar, skillIndex)
        )
    ].join('\n');
}

function buildSkillInfoContent(skillbar: Skillbar, skillIndex: number) {
    const skillId = skillbar.skills[skillIndex];
    const skillData = getSkill(skillId);
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
    if (skillData?.p) skillInfo.push(`Prof: **${getProfessionName(skillData.p)}**`);
    if (skillData?.a) skillInfo.push(`Attrb: **${getAttributeName(skillData.a)}**`);
    if (skillData?.tt) skillInfo.push(`Title: **${getTitleName(skillData.tt)}**`);
    if (skillData?.t) skillInfo.push(`Type: **${getSkillTypeName(skillData)}**`);

    const skillDescription = skillData
        ? [
            `Skill ${skillIndex + 1}: **${skillData.n}** -- [Guild Wars Wiki](<https://wiki.guildwars.com/wiki/${encodeURIComponent(skillData.n)}>)`,
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