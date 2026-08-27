import { Args, Command } from '@sapphire/framework';
import { AttachmentBuilder, Message } from 'discord.js';
import path from 'node:path';
import { ICON_SKILL_SIZE, canvasToBuffer, createCanvas, drawSkill, loadImage } from '../../helper/canvas';
import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { decodePawned } from '../../lib/pawned';
import { GameMode, Skillbar, decodeTemplate, getProfessionName, getSkill } from '../../lib/skills';

const assets = path.join(__dirname, '../../../assets');

export class SkillbarCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'teambuild',
            aliases: prefixAliases(['tb', 't']),
            description: 'Previews multiple skill templates.'
        });
    }

    public registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            buildChatCommand(this, (builder) => (
                builder
                    .addStringOption((option) => (
                        option
                            .setName('templates')
                            .setDescription('The skillbar templates to display, space separated or a paw·ned² teambuild')
                            .setRequired(true)
                    ))
                    .addBooleanOption(option => (
                        option
                            .setName('pvp')
                            .setDescription('This teambuild is intended for PvP')
                    ))
                    .addBooleanOption(option => (
                        option
                            .setName('high-resolution-icons')
                            .setDescription('Use high resolution icons')
                    ))
            ))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const rawTemplates = interaction.options.getString('templates', true);
        return this.execute(interaction, rawTemplates, {
            mode: interaction.options.getBoolean('pvp') ? 'PvP' : 'PvE',
            highResolutionIcons: interaction.options.getBoolean('high-resolution-icons') ?? false,
        });
    }

    public async messageRun(message: Message, args: Args) {
        return this.execute(message, (await args.repeat('string')).join(' '), {
            mode: args.getFlags('pvp') ? 'PvP' : 'PvE',
            highResolutionIcons: args.getFlags('high-resolution-icons'),
        });
    }

    public async execute(origin: CommandOrigin, templates: string, options: {
        mode: GameMode,
        highResolutionIcons: boolean,
    }) {
        const isEphemeral = isEphemeralCommand(origin, false);

        function decodeTeambuild(str: string) {
            try {
                const { builds } = decodePawned(str);
                return builds.map(build => build.skillbar);
            }
            catch {
                return str.split(' ').map(decodeTemplate).filter((skillbar): skillbar is Skillbar => skillbar !== null);
            }
        }

        const skillbars = decodeTeambuild(templates);
        const canvas = createCanvas(9 * ICON_SKILL_SIZE, skillbars.length * ICON_SKILL_SIZE);
        const ctx = canvas.getContext('2d');

        await Promise.all(
            skillbars.map(async (skillbar, skillbarIndex) => {
                const image = await loadImage(path.join(assets, 'professions', `${getProfessionName(skillbar.primary)}.png`));
                ctx.drawImage(image, 0, skillbarIndex * ICON_SKILL_SIZE);

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
                            skillIndex * ICON_SKILL_SIZE + ICON_SKILL_SIZE,
                            skillbarIndex * ICON_SKILL_SIZE,
                            {
                                highResolution: options.highResolutionIcons,
                            }
                        );
                    }));
            }));

        const buffer = await canvasToBuffer(canvas);
        const attachment = new AttachmentBuilder(buffer, {
            name: `${skillbars.map(({ template }) => template).join('|')}.png`,
        });

        return origin.reply({
            files: [attachment],
            ephemeral: isEphemeral,
        });
    }
}
