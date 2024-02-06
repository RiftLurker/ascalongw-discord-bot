import { Args, Command } from '@sapphire/framework';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { Message, codeBlock } from 'discord.js';
import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';

const TRADE_WEBSITE = 'https://kamadan.gwtoolbox.com';
const MAX_RESULTS = 10;

interface SearchEntry {
    t: number;
    s: string;
    m: string;
}

export class MaterialsCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'pricecheck',
            aliases: prefixAliases(['pc']),
            description: `Queries ${TRADE_WEBSITE} for trade results.`,
        });
    }

    public registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            buildChatCommand(this, (builder) => (
                builder.addStringOption(option => (
                    option
                        .setName('search')
                        .setDescription('the term to search form')
                        .setRequired(true)
                ))
            ))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.execute(interaction, interaction.options.getString('search', true));
    }

    public async messageRun(message: Message, args: Args) {
        return this.execute(message, await args.rest('string'));
    }

    public async execute(origin: CommandOrigin, search: string) {
        const isEphemeral = isEphemeralCommand(origin);

        const message = isEphemeral
            ? await origin.deferReply({
                ephemeral: true,
            })
            : await origin.reply(`Searching for **${search}**, just a sec...`);

        const encodedSearch = encodeURIComponent(search);

        const response = await axios.get<SearchEntry[]>(`${TRADE_WEBSITE}/s/${encodedSearch}`);

        if (response.status !== 200) {
            return message.edit(`Sorry, something went wrong fetching results from ${TRADE_WEBSITE}.`);
        }

        const json = response.data;
        if (!json.length) {
            return message.edit(`No results found for **${search}**`);
        }

        // TODO add pagination
        const shownData = json.slice(0, MAX_RESULTS);

        const results = shownData.map((data) => {
            const sender = data.s.padStart(20, ' ');
            const time = formatDistanceToNow(new Date(+data.t), { addSuffix: true });
            const prefix = `${sender}, ${time}:`.padEnd(42, ' ');
            return `${prefix} ${data.m}`;
        });

        return await message.edit([
            `Latest ${results.length} results for **${search}** from ${TRADE_WEBSITE}/search/${encodedSearch}`,
            codeBlock(results.join('\n')),
        ].join('\n'));
    }
}
