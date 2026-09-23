import { Command } from '@sapphire/framework';
import axios from 'axios';
import type { Message } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { CommandOrigin } from '../../helper/commands.ts';
import { buildChatCommand, isEphemeralCommand, prefixAliases } from '../../helper/commands.ts';
import { getEmojiByName } from '../../helper/emoji.ts';
import { emojiPrice } from '../../helper/prices.ts';
import { isNonNullable } from '../../helper/types.ts';
import type { Material } from '../../lib/materials.ts';
import { getMaterials } from '../../lib/materials.ts';

const TRADE_WEBSITE = 'https://kamadan.gwtoolbox.com';

interface TraderQuote {
    p: number;
    t: number;
}

interface TraderQuotes {
    buy: Record<string, TraderQuote | undefined>;
    sell: Record<string, TraderQuote | undefined>;
    updated_at: number;
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

        if (response.status !== 200) {
            return message.edit(`Sorry, something went wrong fetching results from ${TRADE_WEBSITE}.`);
        }

        const json = response.data;

        function formatMaterial(material: Material) {
            const data = json.buy[`0b${material.id.toString(16).padStart(4, '0')}`];
            return {
                name: `${getEmojiByName(material.name)} ${material.name}`,
                value: data ? `${emojiPrice(data.p)}` : 'Unknown',
                inline: true,
            };
        }

        return message.edit({
            content: `Latest trader prices from <${TRADE_WEBSITE}>`,
            embeds: [
                new EmbedBuilder()
                    .setTitle('Common Materials')
                    .addFields(
                        getMaterials('common').map(formatMaterial).filter(isNonNullable),
                    )
                    .setTimestamp(json.updated_at * 1000),
                new EmbedBuilder()
                    .setTitle('Rare Materials')
                    .addFields(
                        getMaterials('rare').map(formatMaterial).filter(isNonNullable),
                    )
                    .setTimestamp(json.updated_at * 1000),
            ],
        });
    }
}
