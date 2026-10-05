import { collectDefaultMetrics, Counter, Gauge } from '@prometheus-io/client';
import { Events, type SapphireClient } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';

collectDefaultMetrics();

export function setupMetrics(client: SapphireClient<true>) {
    if (process.env.METRICS_ENABLE !== 'true') {
        return;
    }

    new Gauge({
        name: 'discord_guild_info',
        help: 'Metadata about Discord guilds',
        labelNames: ['guild', 'name'] as const,
        collect() {
            for (const [guildId, guild] of client.guilds.cache) {
                this.set({
                    guild: guildId,
                    name: guild.name,
                }, 1);
            }
        },
    });

    new Gauge({
        name: 'discord_guild_members',
        help: 'Member count per guild',
        labelNames: ['guild'] as const,
        collect() {
            for (const [guildId, guild] of client.guilds.cache) {
                this.set({
                    guild: guildId,
                }, guild.memberCount);
            }
        },
    });

    const commandUsage = new Counter({
        name: 'bot_command_count',
        help: 'Number of slash command usages',
        labelNames: ['command', 'type', 'subcommand', 'subcommand_group', 'guild'] as const,
    });

    const autocompleteUsage = new Counter({
        name: 'bot_autocomplete',
        help: 'Number of autocomplete usages',
        labelNames: ['command', 'subcommand', 'subcommand_group', 'option', 'guild'] as const,
    });


    client.on(Events.InteractionCreate, (interaction) => {
        if (interaction.isChatInputCommand()) {
            commandUsage.labels({
                command: interaction.commandName,
                type: 'slash',
                subcommand: interaction.options.getSubcommand(false) ?? '',
                subcommand_group: interaction.options.getSubcommandGroup(false) ?? '',
                guild: interaction.guildId ?? 'none',
            }).inc();
        }

        if (interaction.isAutocomplete()) {
            autocompleteUsage.labels({
                command: interaction.commandName,
                subcommand: interaction.options.getSubcommand(false) ?? '',
                subcommand_group: interaction.options.getSubcommandGroup(false) ?? '',
                option: interaction.options.getFocused(true).name,
                guild: interaction.guildId ?? 'none',
            }).inc();
        }
    });

    client.on(Events.MessageCommandRun, (message, command) => {
        if (command instanceof Subcommand) {
            return;
        }
        commandUsage.labels({
            command: command.name,
            type: 'message',
            guild: message.guildId ?? 'none',
        }).inc();
    });

    client.on('messageSubcommandRun', (message, command, payload) => {
        commandUsage.labels({
            command: payload.command.name,
            type: 'message',
            subcommand: command.name,
            guild: message.guildId ?? 'none',
        }).inc();
    });
}

export const buttonUsage = new Counter({
    name: 'bot_button_count',
    help: 'Number of button usages',
    labelNames: ['type', 'guild'] as const,
});
