import { CommandoClient } from 'discord.js-commando';
import fs from 'fs';
import path from 'path';
import permissions from './helper/permissions';
import { addUncachedMessageReactionHandler } from './helper/reaction';
const config = JSON.parse(fs.readFileSync(__dirname+'/../config.json')+'');

function startClient(token: string) {
  token = token.trim();
  if(!token)
    return;
  const client = new CommandoClient({
      commandPrefix: config.prefix,
      owner: config.owners
  });

  client.once('ready', async () => {
      if (!client.user) return;
      console.log(`Ready! Logged in as ${client.user.username}#${client.user.discriminator}.`);

      console.log(await client.generateInvite(permissions));
      addUncachedMessageReactionHandler(client);
      client.user.setPresence({ activity: { name: '-help', type:'LISTENING' }});
  });

  client.registry
      .registerGroups([
          ['gw', 'Guild Wars-related commands']
      ])
      .registerDefaultTypes()
      .registerDefaultGroups()
      .registerDefaultCommands({
          eval: false,
          unknownCommand: false,
          commandState: false
      })
      .registerCommandsIn({
          dirname: path.join(__dirname, 'commands'),
          filter: /(.+)\.(js|ts)$/,
      });

  // Bot token should always be placed in config.json and never committed to repo
  console.log("Bot token is "+token);
  client.login(token);
}

let tokens = config.tokens || [config.token || ''];
tokens.forEach(startClient);

setInterval(function() {
  try {
    if (global.gc) {global.gc();}
  } catch(e) { }
},60000);

/*
    Ping
 */
const express = require('express')
const app = express()
const port = 8080

app.get('/', (req: any, res: any) => {
    res.send('ok')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})