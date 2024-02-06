import { Args, Command } from '@sapphire/framework';
import axios from 'axios';
import { Message } from 'discord.js';
import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';

const WIKI_WEBSITE = 'https://wiki.guildwars.com';

export class WikiCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'wiki',
            aliases: prefixAliases(['gww', 'guildwarswiki']),
            description: 'Queries Guild Wars Wiki for a search term.',
        });
    }

    public registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            buildChatCommand(this, (builder) => (
                builder
                    .addStringOption((option) => (
                        option
                            .setName('search')
                            .setDescription('enter a search term')
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

        const url = wikiSearchUrl(search);

        let responseUrl = url;

        try {
            const response = await axios.get(url);
            responseUrl = response.request.res.responseUrl;
            // Find canonical link
            const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/.exec(response.data);
            if(canonical) {
                responseUrl = canonical[1];
            }
        }
        catch {
            // GWW can give error 403 if it suspects that we're a bot e.g. hosted on AWS etc
            // NBD, but give the URL back to discord and it'll try to fill it out
        }

        await message.edit(responseUrl);
    }
}

export function wikiSearchUrl(search: string) {
    return `${WIKI_WEBSITE}/index.php?search=${encodeURIComponent(search.toLocaleLowerCase())}`;
}
