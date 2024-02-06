import { Command, container } from '@sapphire/framework';
import { Message, OAuth2Scopes, PermissionFlagsBits } from 'discord.js';
import { CommandOrigin, buildChatCommand, isEphemeralCommand } from '../helper/commands';

export class TemplateCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'invite',
            description: 'Provides a link to invite the bot to your own server',
        });
    }

    public registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            buildChatCommand(this)
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.execute(interaction);
    }

    public async messageRun(message: Message) {
        return this.execute(message);
    }

    public async execute(origin: CommandOrigin) {
        const isEphemeral = isEphemeralCommand(origin);

        return origin.reply({
            content: await container.client.generateInvite({
                scopes: [
                    OAuth2Scopes.Bot,
                ],
                permissions: [
                    PermissionFlagsBits.AddReactions,
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.UseExternalEmojis,
                ],
            }),
            ephemeral: isEphemeral,
        });
    }
}
