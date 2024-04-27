import { Subcommand } from '@sapphire/plugin-subcommands';
import { isFuture } from 'date-fns';
import { EmbedBuilder, Message } from 'discord.js';
import { CommandOrigin, buildChatSubCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { ACTIVITIES, getActivity, getActivityMeta } from '../../lib/activities';
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
const BLANKFIELD = {
    name: '**    **',
    value: '**    **',
    inline: false,
};

export class ZaishenQuestCommand extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'zaishen-quest',
            aliases: prefixAliases(['zq']),
            description: 'Displays Zaishen Quest Information',
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
                }
            ]
        });
    }

    public registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand(
            buildChatSubCommand(this, {
                current: {
                    description: 'Displays current Zaishen Quest Information',
                },
                next: {
                    description: 'Displays next Zaishen Quest Information',
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

        const activityMeta = getActivityMeta('zaishen-mission', date, activityOffset);
        const dateInfo = isFuture(activityMeta.startDate)
            ? { name: "Starts",
                value: getDiscordTimestamp(activityMeta.startDate, "R")
              }
            : { name: "Ends",
                value: getDiscordTimestamp(activityMeta.endDate, "R")
              };

        return origin.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Zaishen Quests')
                    .setURL('https://wiki.guildwars.com/wiki/Zaishen_Challenge_Quest')
                    .addFields(
                        createActivityField('Zaishen Mission', 'zaishen-mission', date, activityOffset),
                        INLINE_BLANKFIELD,
                        createActivityField('Zaishen Bounty', 'zaishen-bounty', date, activityOffset),
                        BLANKFIELD,
                        createActivityField('Zaishen Vanquish', 'zaishen-vanquish', date, activityOffset),
                        INLINE_BLANKFIELD,
                        createActivityField('Zaishen Combat', 'zaishen-combat', date, activityOffset),
                        dateInfo
                    )
            ],
            ephemeral: isEphemeral,
        });
    }
}

function createActivityField<T extends string>(name: string, type: keyof typeof ACTIVITIES & `zaishen-${T}`, date: Date, activityOffset: number) {
    return {
        name,
        value: getActivity(type, date, activityOffset),
        inline: true,
    };
}
