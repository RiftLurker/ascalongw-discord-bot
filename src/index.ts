import { ApplicationCommandRegistries, SapphireClient } from '@sapphire/framework';
import { ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import express from 'express';

import config from '../config.json';

const client = new SapphireClient({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
    loadMessageCommandListeners: true,
    loadDefaultErrorListeners: true,
});

const tokens = 'tokens' in config
    ? config.tokens
    : [config.token];

tokens.forEach(async (token) => {
    await client.login(token);
    client.user?.setPresence({
        activities: [
            {
                name: 'slash commands',
                type: ActivityType.Listening,
            },
        ],
    });
});

if (config.devGuild) {
    ApplicationCommandRegistries.setDefaultGuildIds([config.devGuild]);
}

setInterval(function() {
    try {
        if (global.gc) {global.gc();}
    }
    catch {
        //
    }
}, 60000);

/*
 * Ping
 */
const app = express();
app.get('/', (req, res) => {
    res.send('ok');
});

app.listen(config.port ?? 80);
