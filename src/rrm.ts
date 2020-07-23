import * as discord from "discord.js";
import * as secret from "./secret.json";

const client = new discord.Client();
client.login(secret.token);

const channelIDs = {
    activeTicketsCategory: "735251571260260414",
    transcripts: "735969996773261404"
};

function getChannel(chid: string): discord.TextChannel {
    return client.channels.resolve(chid) as discord.TextChannel;
}
const msgopts: discord.MessageOptions = {
    allowedMentions: { parse: [], roles: [], users: [] }
};

client.on("message", async msg => {
    if (msg.channel.type === "dm") {
        if (!msg.author.bot) await msg.reply("dont pm me :(");
        return;
    }
    if (msg.channel.parent?.id !== channelIDs.activeTicketsCategory) return; // wrong channel nope
    await getChannel(channelIDs.transcripts).send(
        msg.author.toString() + ": " + msg.content,
        msg.embeds[0]
            ? Object.assign({ embeds: msg.embeds[0] }, msgopts)
            : msgopts
    );
    for (let atchmnt of msg.attachments) {
        await getChannel(channelIDs.transcripts).send(
            "Attachment: " + atchmnt[1].url,
            msgopts
        );
    }
});

// client.on("");

// Watch for rank reaction in #rank requests
// Create a ticket channel (max 1 per person)
// log all messages+images into a rank history channel
