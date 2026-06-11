// index.js
// Discord welcome bot + VIP embed command + daily Imgur image update + tiny web server for Render

const express = require("express");
const cron = require("node-cron");

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
  "1512883409783881780",
  "1512883433884356669",
  "1512883439152398337",
  "1512883502612221982",
  "1512883783987363930",
  "1512883791314681886",
];

// ---- Daily update config ----
const DAILY_UPDATE_CHANNEL_ID = process.env.DAILY_UPDATE_CHANNEL_ID;
const DAILY_UPDATE_MESSAGE =
  process.env.DAILY_UPDATE_MESSAGE || "🌙 Daily update!";

const TIMEZONE = process.env.TIMEZONE || "America/Phoenix";

const imgurImages = (process.env.IMGUR_IMAGES || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

function pickRandomItems(array, count) {
  return [...array].sort(() => Math.random() - 0.5).slice(0, count);
}

async function sendDailyUpdate() {
  if (!DAILY_UPDATE_CHANNEL_ID) {
    console.error("Missing DAILY_UPDATE_CHANNEL_ID environment variable.");
    return;
  }

  if (imgurImages.length < 6) {
    console.error("IMGUR_IMAGES must contain at least 6 image URLs.");
    return;
  }

  const channel = await client.channels.fetch(DAILY_UPDATE_CHANNEL_ID).catch(() => null);

  if (!channel) {
    console.error("Could not find daily update channel.");
    return;
  }

  const selectedImages = pickRandomItems(imgurImages, 6);

  const embeds = selectedImages.map((url, index) =>
    new EmbedBuilder()
      .setColor(0x00ff66)
      .setImage(url)
      .setFooter({ text: `Image ${index + 1} of 6` })
  );

  await channel.send({
    content: customMessage,
    embeds,
  });

  console.log("Daily update sent.");
}

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

  // Runs every day at 12:00 AM in your timezone
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await sendDailyUpdate();
      } catch (err) {
        console.error("Daily update failed:", err);
      }
    },
    {
      timezone: TIMEZONE,
    }
  );

  console.log(`Daily update scheduled for 12:00 AM ${TIMEZONE}`);
});

// Command:
// ?vip imgurImage accessVipContentLink clickChannelLink
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

// MANUAL DAILY TEST
  if (message.content.startsWith("?dailytest")) {
    try {
      const customMessage = message.content
        .replace("?dailytest", "")
        .trim();

      await sendDailyUpdate(
        customMessage || DAILY_UPDATE_MESSAGE
      );

      return message.reply("✅ Daily update actually posted.");
    } catch (err) {
      console.error(err);

      return message.reply(
        `❌ Failed:\n\`\`\`${err.message}\`\`\``
      );
    }
  }

// VIP COMMAND
if (!message.content.startsWith("?vip")) return;

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
