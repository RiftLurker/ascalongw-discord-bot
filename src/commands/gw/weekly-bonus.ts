import { Subcommand } from '@sapphire/plugin-subcommands';
import { formatDistanceToNowStrict, isFuture } from 'date-fns';
import { EmbedBuilder, Message } from 'discord.js';
import { CommandOrigin, buildChatSubCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { getActivity, getActivityMeta } from '../../lib/activities';
import { getDiscordTimestamp } from '../../helper/timestamp';

/**
 * A blank field to create spacing between embed fields.
 * The markdown syntax is necessary because Discord ignores whitespace.
 */
const INLINE_BLANKFIELD = {
    name: '**    **',
    value: '**    **',
    inline: true,
};

export class TemplateCommand extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'weekly-bonus',
            aliases: prefixAliases(['weekly', 'bonus', 'bn', 'wbn']),
            description: 'Displays weekly bonus information',
            subcommands: [
                {
                    name: 'current',
                    messageRun: 'messageRunCurrent',
                    chatInputRun: 'chatInputRunCurrent',
                    default: true,
                },
                {
                    name: 'next',
                    messageRun: 'messageRunNext',
                    chatInputRun: 'chatInputRunNext',
                },
            ],
        });
    }

    public registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand(
            buildChatSubCommand(this, {
                current: {
                    description: 'Displays this weeks bonus',
                },
                next: {
                    description: 'Displays next weeks bonus',
                }
            })
        );
    }

    public async chatInputRunCurrent(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.execute(interaction);
    }

    public async chatInputRunNext(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.execute(interaction, 1);
    }

    public async messageRunCurrent(message: Message) {
        return this.execute(message);
    }

    public async messageRunNext(message: Message) {
        return this.execute(message, 1);
    }

    public async execute(origin: CommandOrigin, activityOffset = 0) {
        const isEphemeral = isEphemeralCommand(origin);
        const date = new Date();

        const activityMeta = getActivityMeta('pve-bonus', date, activityOffset);
        const pveBonus = getActivity('pve-bonus', date, activityOffset);
        const pvpBonus = getActivity('pvp-bonus', date, activityOffset);

        const dateInfo = isFuture(activityMeta.startDate)
            ? {
                name: "Starts",
                value: getDiscordTimestamp(activityMeta.startDate, "R")
            }
            : {
                name: "Ends",
                value: getDiscordTimestamp(activityMeta.endDate, "R")
            }

        origin.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Weekly Bonus')
                    .setURL('https://wiki.guildwars.com/wiki/Weekly_bonuses')
                    .addFields(
                        {
                            name: `PvE bonus (${pveBonus.name})`,
                            value: pveBonus.info,
                            inline: true,
                        },
                        INLINE_BLANKFIELD,
                        {
                            name: `PvP bonus (${pvpBonus.name})`,
                            value: pvpBonus.info,
                            inline: true,
                        },
                        dateInfo
                    )

            ],
            ephemeral: isEphemeral,
        });
    }
}
