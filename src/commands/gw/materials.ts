import { Command } from '@sapphire/framework';
import axios from 'axios';
import { EmbedBuilder, Message, formatEmoji } from 'discord.js';
import { CommandOrigin, buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands';
import { emojiPrice } from '../../helper/prices';
import { isNonNullable } from '../../helper/types';
import { Material, getMaterials } from '../../lib/materials';

const TRADE_WEBSITE = 'https://kamadan.gwtoolbox.com';

interface TraderQuote {
    p: number;
    t: number;
}

interface TraderQuotes {
    buy: Record<string, TraderQuote>;
}

export class MaterialsCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'materials',
            aliases: prefixAliases(['mats']),
            description: `Queries ${TRADE_WEBSITE} for current material trader prices.`,
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

        const message = isEphemeral
            ? await origin.deferReply({
                ephemeral: true,
            })
            : await origin.reply('Fetching current material prices, just a sec...');

        const response = await axios.get<TraderQuotes>(`${TRADE_WEBSITE}/trader_quotes`);

        if (response.status !== 200 || !response.data) {
            return message.edit(`Sorry, something went wrong fetching results from ${TRADE_WEBSITE}.`);
        }

        const json = response.data;

        function formatMaterial(material: Material) {
            const data = json.buy[material.id];
            if (!data) {
                return;
            }
            return {
                name: `${formatEmoji(material.emoji)} ${material.name}`,
                value: ` ${emojiPrice(data.p)}`,
                inline: true,
            };
        }

        return message.edit({
            content: `Latest trader prices from ${TRADE_WEBSITE}`,
            embeds: [
                new EmbedBuilder()
                    .setTitle('Common Materials')
                    .addFields(
                        getMaterials('common').map(formatMaterial).filter(isNonNullable),
                    ),
                new EmbedBuilder()
                    .setTitle('Rare Materials')
                    .addFields(
                        getMaterials('rare').map(formatMaterial).filter(isNonNullable),
                    ),
            ],
        });
    }
}
