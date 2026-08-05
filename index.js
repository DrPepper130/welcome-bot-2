// index.js
// Discord welcome bot + VIP embed command + daily Imgur image update + tiny web server for Render

const express = require("express");
const cron = require("node-cron");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const channelIDs = [
  "1519795396107567374",
  "1519795396107567375",
  "1519795396107567376",
  "1519795396107567382",
  "1519795405225722039",
  "1519795405225722041",
  "1512883409783881780",
  "1512883433884356669",
  "1512883439152398337",
  "1512883502612221982",
  "1512883783987363930",
  "1512883791314681886",
  "1534641203872534660",
  "1534641190819860570",
  "1534641190849347786",
  "1534641204480966908",
  "1534641245362716782",
  "1534641257966469331",
];

// ---- Daily update config ----
const DAILY_UPDATE_CHANNEL_IDS = (
  process.env.DAILY_UPDATE_CHANNEL_IDS ||
  process.env.DAILY_UPDATE_CHANNEL_ID ||
  ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
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

async function sendDailyUpdate(customMessage = DAILY_UPDATE_MESSAGE) {
  if (DAILY_UPDATE_CHANNEL_IDS.length === 0) {
    return console.error(
      "Missing DAILY_UPDATE_CHANNEL_IDS environment variable."
    );
  }

  const selectedImages = pickRandomItems(
    imgurImages,
    Math.min(6, imgurImages.length)
  );

  // Download the images once, then reuse the buffers for both servers.
  const downloadedImages = [];

  for (let i = 0; i < selectedImages.length; i++) {
    const imageUrl = selectedImages[i];

    try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        console.error(
          `Failed to fetch image: ${imageUrl} (${response.status})`
        );
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extension = imageUrl.split(".").pop()?.split("?")[0] || "png";

      // Prevent invalid filenames when the URL does not have a normal extension.
      if (!/^[a-zA-Z0-9]+$/.test(extension) || extension.length > 5) {
        extension = "png";
      }

      downloadedImages.push({
        buffer,
        name: `daily-image-${i + 1}.${extension}`,
      });
    } catch (err) {
      console.error(`Image download failed: ${imageUrl}`, err);
    }
  }

  let successfulSends = 0;

  for (const channelId of DAILY_UPDATE_CHANNEL_IDS) {
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel || !channel.isTextBased()) {
        console.error(
          `Could not find text channel for daily update: ${channelId}`
        );
        continue;
      }

      // Create fresh AttachmentBuilder objects for each channel.
      const files = downloadedImages.map(
        ({ buffer, name }) =>
          new AttachmentBuilder(buffer, {
            name,
          })
      );

      await channel.send({
        content: customMessage,
        files,
      });

      successfulSends++;
      console.log(`Daily update sent to channel ${channelId}.`);
    } catch (err) {
      console.error(
        `Daily update failed for channel ${channelId}:`,
        err
      );
    }
  }
  console.log(
    `Daily update completed: ${successfulSends}/${DAILY_UPDATE_CHANNEL_IDS.length} channels successful.`
  );
}



client.once("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);

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

  console.log(
    `Daily update scheduled for 12:00 AM ${TIMEZONE} in ${DAILY_UPDATE_CHANNEL_IDS.length} channels.`
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Manual daily test:
  // ?dailytest your custom message here
  if (message.content.startsWith("?dailytest")) {
    try {
      const customMessage = message.content.replace("?dailytest", "").trim();

      await sendDailyUpdate(customMessage || DAILY_UPDATE_MESSAGE);

      return message.react("✅");
    } catch (err) {
      console.error("Daily test failed:", err);
      return message.react("❌");
    }
  }

  // Command:
  // ?vip imgurImage accessVipContentLink clickChannelLink
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
