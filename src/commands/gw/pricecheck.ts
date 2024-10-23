import { Args, Command } from '@sapphire/framework';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { Message, codeBlock } from 'discord.js';
import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';

const TRADE_WEBSITE = 'https://kamadan.gwtoolbox.com';
const MAX_RESULTS = 10;

interface SearchResult {
    num_results: number;
    results: SearchEntry[];
}

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

        const response = await axios.get<SearchResult>(`${TRADE_WEBSITE}/s/${encodedSearch}`);

        if (response.status !== 200) {
            return message.edit(`Sorry, something went wrong fetching results from ${TRADE_WEBSITE}.`);
        }

        const json = response.data;
        if (!json.num_results) {
            return message.edit(`No results found for **${search}**`);
        }

        // TODO add pagination

        const results = json.results.map((data) => {
            const sender = data.s.padStart(20, ' ');
            const time = formatDistanceToNow(new Date(+data.t), { addSuffix: true });
            const prefix = `${sender}, ${time}:`.padEnd(42, ' ');
            return `${prefix} ${data.m}`;
        });

        let longestContent = null;

        for (let i = 0; i < results.length; i++) {
            const content = [
                `Latest ${i} results for **${search}** from ${TRADE_WEBSITE}/search/${encodedSearch}`,
                codeBlock(results.slice(0, i).join('\n')),
            ].join('\n');

            if (content.length > 2000) {
                break;
            }
            
            longestContent = content;
        }

        if (longestContent) {
            return await message.edit(longestContent);
        }
    }
}
