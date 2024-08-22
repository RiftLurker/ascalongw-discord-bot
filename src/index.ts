import { ApplicationCommandRegistries, SapphireClient } from '@sapphire/framework';
import { ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import express from 'express';


import config from '../config.json';

async function initializeClient(token : string) {
    if(!(token && token.length)) {
        throw new Error('Invalid token');
    }
    const clientArgs = {
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
        baseUserDirectory: __dirname
    };

    const client = new SapphireClient(clientArgs);

    await client.login(token);
    client.user?.setPresence({
        activities: [
            {
                name: 'slash commands',
                type: ActivityType.Listening,
            },
        ],
    });
    return client;
}

const tokens = 'tokens' in config
    ? config.tokens
    : [config.token];

console.log('Application tokens:', tokens);

tokens.forEach(async (token) => {
    if(!(token && token.length)) {
        return;
    }
    initializeClient(token).catch((e) => {
        console.error(e);
        process.exit(1);
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
