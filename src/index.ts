import {
    ApplicationCommandRegistries,
    SapphireClient,
} from '@sapphire/framework';
import { ActivityType, Client, GatewayIntentBits, Partials } from 'discord.js';
import http from 'node:http';

import { register } from '@prometheus-io/client';
import 'dotenv/config';
import { setupMetrics } from './lib/metrics.ts';
import { syncApplicationEmojis } from './sync-emojis.ts';

if (process.env.ASCALONGW_DEVSERVER) {
    ApplicationCommandRegistries.setDefaultGuildIds([
        process.env.ASCALONGW_DEVSERVER,
    ]);
}

if (!process.env.DISCORD_TOKEN) {
    console.error('No token provided');
    process.exit(1);
}

if (!process.env.SKIP_EMOJI_SYNC) {
    // Creating a lightweight client to sync emojis before all the sapphire pieces are loaded
    const syncClient = new Client({ intents: [] });
    await syncClient.login(process.env.DISCORD_TOKEN);
    await new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        syncClient.once('clientReady', async (client) => {
            await syncApplicationEmojis(client);
            return resolve(void 0);
        });
    });
    await syncClient.destroy();
}

const clientArgs = {
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    loadMessageCommandListeners: true,
    loadDefaultErrorListeners: true,
    baseUserDirectory: import.meta.dirname,
};

export const client = new SapphireClient(clientArgs);

void client.login(process.env.DISCORD_TOKEN);

client.once('clientReady', (c) => {
    c.user.setPresence({
        activities: [
            {
                name: 'slash commands',
                type: ActivityType.Listening,
            },
        ],
    });
    setupMetrics(c);
});

setInterval(function() {
    try {
        if (global.gc) {
            global.gc();
        }
    }
    catch {
    //
    }
}, 60000);

http
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .createServer(async (req, res) => {
        switch (req.url) {
        case '/':
            return res.end('ok');
        case '/metrics':
            if (process.env.METRICS_ENABLE !== 'true') {
                return res.end('Metrics are disabled');
            }
            res.setHeader('Content-Type', register.contentType);
            return res.end(await register.metrics());
        }
    })
    .listen(process.env.PORT ?? 80);
