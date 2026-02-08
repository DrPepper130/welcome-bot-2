// index.js
// Discord welcome bot + tiny web server (required for Render)

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const channelIDs = [
  "1456396121164480542",
  "1463965523699175669",
  "1434256233010823389",
  "1456396718076858632",
  "1446641972654903306",
];

// ---- Web server (Render expects a listening port) ----
const app = express();

app.get("/", (req, res) => {
  res.status(200).send("OK - bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server listening on ${PORT}`));

// ---- Discord bot ----
if (!process.env.DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

// Sends a short welcome message in each channel and deletes it after 3s
client.on("guildMemberAdd", async (member) => {
  console.log(`New member joined: ${member.user.tag} (${member.id})`);

  // 200ms between channels (fast). If you get rate-limited, increase this to 1000-2000.
  const intervalMs = 200;

  channelIDs.forEach((channelId, i) => {
    setTimeout(async () => {
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) return;

      try {
        const msg = await channel.send(`Hey <@${member.id}>, enjoy your stay! 😘💦`);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
      } catch (err) {
        console.error(`Failed in channel ${channelId}:`, err);
      }
    }, i * intervalMs);
  });
});

client.login(process.env.DISCORD_TOKEN);
