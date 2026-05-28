// index.js
// Discord welcome bot + VIP embed command + tiny web server for Render

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const channelIDs = [
  "1499603884883185696",
  "1499603884883185697",
  "1499603884883185698",
  "1499603884883185703",
  "1499603885319524387",
  "1499603885319524389",

];

// ---- Web server ----
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

// Command:
// ?vip imgurImage accessVipContentLink clickChannelLink
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("?vip")) return;

  const args = message.content.trim().split(/\s+/);

  const imgurImage = args[1];
  const accessVipContentLink = args[2];
  const clickChannelLink = args[3];

  if (!imgurImage || !accessVipContentLink || !clickChannelLink) {
    return message.reply(
      "Usage: `?vip imgurImage accessVipContentLink clickChannelLink`"
    );
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff66)
    .setTitle("🔞 Redeem your VIP Access key here! 🔞")
    .setDescription(
      "**Follow the simple steps below to unlock your private vault!**\n\n" +
        `> Click [# 👑・VIP-ACCESS](${clickChannelLink}).\n` +
        "> Complete checkout to redeem your key.\n" +
        "> Press Redeem Key and enter the key.\n" +
        "> Done - enjoy your access!"
    )
    .setImage(imgurImage);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Access VIP Content")
      .setStyle(ButtonStyle.Link)
      .setURL(accessVipContentLink),

    new ButtonBuilder()
      .setCustomId("redeem_key")
      .setLabel("Redeem Key")
      .setStyle(ButtonStyle.Success)
  );

  await message.channel.send({
    embeds: [embed],
    components: [buttons],
  });
});

// Button + popup modal handler
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId !== "redeem_key") return;

    const modal = new ModalBuilder()
      .setCustomId("redeem_key_modal")
      .setTitle("Redeem VIP Key");

    const keyInput = new TextInputBuilder()
      .setCustomId("vip_key")
      .setLabel("Enter your VIP key")
      .setPlaceholder("Paste your key here")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(keyInput);

    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId !== "redeem_key_modal") return;

    const vipKey = interaction.fields.getTextInputValue("vip_key");

    console.log(
      `VIP key submitted by ${interaction.user.tag} (${interaction.user.id}): ${vipKey}`
    );

    await interaction.reply({
      content: "✅ Your key was submitted. Please wait while it is reviewed.",
      ephemeral: true,
    });
  }
});

// Sends a short welcome message in each channel and deletes it after 6s
client.on("guildMemberAdd", async (member) => {
  console.log(`New member joined: ${member.user.tag} (${member.id})`);

  const intervalMs = 200;

  channelIDs.forEach((channelId, i) => {
    setTimeout(async () => {
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) return;

      try {
        const msg = await channel.send(
          `Hey <@${member.id}>, enjoy your stay! 😘💦`
        );
        setTimeout(() => msg.delete().catch(() => {}), 6000);
      } catch (err) {
        console.error(`Failed in channel ${channelId}:`, err);
      }
    }, i * intervalMs);
  });
});

client.login(process.env.DISCORD_TOKEN);
