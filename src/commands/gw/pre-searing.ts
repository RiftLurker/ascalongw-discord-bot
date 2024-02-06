import { Subcommand } from '@sapphire/plugin-subcommands';
import { isFuture } from 'date-fns';
import { EmbedBuilder, Message } from 'discord.js';
import { CommandOrigin, buildChatSubCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { GIFT_OF_THE_HUNTSMAN, VANGUARD_INITIATE } from '../../helper/emoji';
import { isNonNullable } from '../../helper/types';
import { ACTIVITIES, getActivity, getActivityMeta } from '../../lib/activities';

/**
 * A blank field to create spacing between embed fields.
 * The markdown syntax is necessary because Discord ignores whitespace.
 */
const INLINE_BLANKFIELD = {
    name: '**    **',
    value: '**    **',
    inline: true,
};

export class PreSearingCommand extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'pre-searing',
            aliases: prefixAliases(['pre', 'p']),
            description: 'Displays Pre Searing activity information',
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
                    description: 'Displays current Pre Searing activity information'
                },
                next: {
                    description: 'Displays next Pre Searing activity information'
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

        return origin.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Pre Searing Activities')
                    .setURL('https://wiki.guildwars.com/wiki/Daily_activities')
                    .addFields(
                        createActivityField(`${VANGUARD_INITIATE} Vanguard Quest`, 'vanguard', date, activityOffset),
                        INLINE_BLANKFIELD,
                        createActivityField(`${GIFT_OF_THE_HUNTSMAN} Nicholas Sandford`, 'nicholas-sandford', date, activityOffset),
                    )
            ],
            ephemeral: isEphemeral,
        });
    }
}

function createActivityField(name: string, type: keyof typeof ACTIVITIES, date: Date, activityOffset: number) {
    const activityMeta = getActivityMeta(type, date, activityOffset);

    return {
        name,
        value: [
            getActivity(type, date, activityOffset),
            isFuture(activityMeta.startDate)
                ? `Starts in ${activityMeta.dailyCountdown}`
                : isFuture(activityMeta.endDate)
                    ? `Ends in ${activityMeta.dailyCountdown}`
                    : null,
        ].filter(isNonNullable).join('\n'),
        inline: true,
    };
}
