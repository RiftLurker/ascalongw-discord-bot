import { Subcommand } from '@sapphire/plugin-subcommands';
import { isFuture } from 'date-fns';
import { Message, hideLinkEmbed } from 'discord.js';
import { CommandOrigin, buildChatSubCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { getActivity, getActivityMeta } from '../../lib/activities';
import { wikiSearchUrl } from './wiki';
import { getDiscordTimestamp } from '../../helper/timestamp';

export class ZaishenQuestCommand extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'nicholas-the-traveler',
            aliases: prefixAliases(['nick', 'n']),
            description: 'Displays Nicholas the Traveler information.',
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
                    description: 'Displays current Nicholas the Traveler information.',
                },
                next: {
                    description: 'Displays next Nicholas the Traveler information.',
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

        const activityMeta = getActivityMeta('nicholas-the-traveler', date, activityOffset);
        const [verb, footer] = isFuture(activityMeta.startDate)
            ? ['will collect', `Starting ${getDiscordTimestamp(activityMeta.startDate, "R")}}!`]
            : ['is collecting', `Moving away ${getDiscordTimestamp(activityMeta.endDate, "R")}!`];

        const { region, amount, item, area } = getActivity('nicholas-the-traveler', date, activityOffset);

        return origin.reply({
            content: [
                `[Nicholas The Traveler](${hideLinkEmbed('https://wiki.guildwars.com/wiki/Nicholas_the_Traveler')})`,
                `${verb} **${amount} [${item}](${hideLinkEmbed(wikiSearchUrl(item))})**`,
                `per present at **[${area}](${hideLinkEmbed(wikiSearchUrl(area))})** in ${region}.`,
                footer,
            ].join('\n'),
            ephemeral: isEphemeral,
        });
    }
}
