import { Command } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Message, SlashCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import config from '../../config.json';

export type CommandOrigin = Message | Command.ChatInputCommandInteraction

export function isEphemeralCommand(origin: CommandOrigin, defaultValue = true): origin is Command.ChatInputCommandInteraction {
    if (origin instanceof Message) {
        return false;
    }
    const isPublic = origin.options.getBoolean('public') ?? !defaultValue;

    return !isPublic;
}

export function buildChatCommand(command: Command, fn?: (builder: SlashCommandBuilder) => unknown) {
    return (builder: SlashCommandBuilder) => {
        builder
            .setName(command.name)
            .setDescription(command.description);

        fn?.(builder);

        builder
            .addBooleanOption((option) => (
                option
                    .setName('public')
                    .setDescription('Should this command be visible to others')
            ));
    };
}

export function buildChatSubCommand(
    command: Subcommand,
    subcommandData: Record<string, {
        description: string;
        fn?: (subcommandGroup: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder
    }>
) {
    return (builder: SlashCommandBuilder) => {
        builder
            .setName(command.name)
            .setDescription(command.description);

        command.parsedSubcommandMappings.forEach((parsedSubcommand) => {
            const data = subcommandData[parsedSubcommand.name];
            if (!data) {
                return;
            }

            builder.addSubcommand((subcommand) => {

                subcommand
                    .setName(parsedSubcommand.name)
                    .setDescription(data.description);

                data.fn?.(subcommand);

                subcommand.addBooleanOption((option) => (
                    option
                        .setName('public')
                        .setDescription('Should this command be visible to others')
                ));

                return subcommand;
            });
        });
    };
}

export function prefixAliases(aliases: string[]) {
    if (!config.prefix) {
        return aliases;
    }

    return [
        ...aliases,
        ...aliases.map((alias) => config.prefix + alias),
    ];
}
