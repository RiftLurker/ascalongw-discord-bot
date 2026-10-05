import {
    ApplicationCommandRegistries,
    SapphireClient
} from '@sapphire/framework';
import type { ClientOptions } from 'discord.js';
import { ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import http from 'node:http';

import { register } from '@prometheus-io/client';
import 'dotenv/config';
import { refetchEmojis } from './helper/emoji.ts';
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
} satisfies ClientOptions;

export const client = new SapphireClient(clientArgs);

await client.login(process.env.DISCORD_TOKEN);

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

// eslint-disable-next-line @typescript-eslint/no-misused-promises
client.once('clientReady', async (c) => {
    await refetchEmojis(c);
    try {
        await syncApplicationEmojis(c);
    }
    catch {
        client.logger.error('Failed to sync application emojis');
        process.exit(1);
    }
    await refetchEmojis(c);
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
