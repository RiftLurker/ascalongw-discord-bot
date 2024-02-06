import { Args, Command } from '@sapphire/framework';
import { AttachmentBuilder, Message } from 'discord.js';
import path from 'node:path';
import { Bitmap } from 'pureimage/types/bitmap';
import { canvasToBuffer, createCanvas, loadImage } from '../../helper/canvas';
import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { Skillbar, decodeTemplate, getProfessionName } from '../../lib/skills';

const assets = path.join(__dirname, '../../../assets');

const IMAGE_SIZE = 64;

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
                            .setDescription('the skillbar templates to display, space separated')
                            .setRequired(true)
                    ))
            ))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const rawTemplates = interaction.options.getString('templates', true);
        return this.execute(interaction, rawTemplates.split(' '));
    }

    public async messageRun(message: Message, args: Args) {
        return this.execute(message, await args.repeat('string'));
    }

    public async execute(origin: CommandOrigin, templates: string[]) {
        const isEphemeral = isEphemeralCommand(origin, false);

        const skillbars = templates.map(decodeTemplate).filter((skillbar): skillbar is Skillbar => skillbar !== null);
        const canvas = createCanvas(9 * IMAGE_SIZE, skillbars.length * IMAGE_SIZE);
        const ctx = canvas.getContext('2d');

        const images = await Promise.all(skillbars.reduce((acc, skillbar) => {
            return [
                ...acc,
                loadImage(path.join(assets, 'professions', `${getProfessionName(skillbar.primary)}.png`)),
                ...skillbar.skills.map(skillID => loadImage(path.join(assets, 'skills', `${skillID}.jpg`))),
            ];
        }, [] as Promise<Bitmap>[]));

        images.forEach((image, index) => ctx.drawImage(image, (index % 9) * IMAGE_SIZE, Math.floor(index / 9) * IMAGE_SIZE, IMAGE_SIZE, IMAGE_SIZE));

        const buffer = await canvasToBuffer(canvas);
        const attachment = new AttachmentBuilder(buffer, {
            name: `${templates.join('|')}.png`,
        });

        return origin.reply({
            files: [attachment],
            ephemeral: isEphemeral,
        });
    }
}
