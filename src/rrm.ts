import * as discord from "discord.js";
import * as secret from "./secret.json";
import { promises as fs } from "fs";
const words = require("./words.json") as string[];

const client = new discord.Client({
    partials: ["MESSAGE", "CHANNEL", "REACTION"]
});
client.login(secret.token);

const channelIDs = {
    activeTicketsCategory: "735251571260260414",
    transcripts: "735969996773261404",
    ticketmakr: "735250354450464808"
};

function getChannel(chid: string): discord.TextChannel {
    return client.channels.resolve(chid) as discord.TextChannel;
}
const msgopts: discord.MessageOptions = {
    allowedMentions: { parse: [], roles: [], users: [] }
};

let localtrophycount: { [key: string]: number } = {};

client.on("ready", async () => {
    console.log("started");
    try {
        let [rschanid, rsmsgid, dstnc] = (
            await fs.readFile("__restarting", "utf-8")
        ).split("|");
        await fs.unlink("__restarting");
        let chan = (await client.channels.fetch(
            rschanid
        )) as discord.TextChannel;
        let msg = await chan.messages.fetch(rsmsgid);
        let timecount = new Date().getTime() - +dstnc;
        let timemsg: string;
        if (timecount < 10_000) {
            timemsg = "";
        } else {
            timemsg = ". sorry it took a while. i think there was an error :(";
        }
        await chan.send("yay im back" + timemsg);
        await msg.delete();
    } catch {}
});

client.on("message", async msg => {
    if (msg.partial) await msg.fetch();
    if (msg.channel.type === "dm") {
        if (!msg.author.bot) await msg.reply("dont pm me :(");
        return;
    }
    if (msg.content.includes(client.user!.id) && !msg.author.bot) {
        if (msg.content.includes("restart")) {
            if (msg.author.id === "341076015663153153") {
                let msgsnt = await msg.reply(
                    "ok. ill be back in a moment <a:loading:721573242686668861>"
                );
                await fs.writeFile(
                    "__restarting",
                    msg.channel + "|" + msgsnt.id + "|" + new Date().getTime()
                );
                process.exit(0);
            } else {
                await msg.reply("no you dont have control over me >:[");
            }
            return;
        }
        if (msg.content.includes("randomword")) {
            let rword = words[Math.floor(Math.random() * words.length)];
            await msg.channel.send("quick type the word", {
                files: [
                    {
                        name: "type.png",
                        attachment:
                            "https://dummyimage.com/400x100/000/fff.png&text=" +
                            rword
                    }
                ],
                ...msgopts
            });
            const start = new Date().getTime();
            const collectr = new discord.MessageCollector(
                msg.channel as discord.TextChannel,
                m => m.content.toLowerCase() === rword.toLowerCase(),
                { time: 10000 }
            );
            collectr.on("collect", async msg_ => {
                const msg = msg_ as discord.Message;
                collectr.stop();
                let time = new Date().getTime() - start;
                localtrophycount[msg.author.id] =
                    (localtrophycount[msg.author.id] || 0) + 1;
                let tc = localtrophycount[msg.author.id];
                await msg.channel.send(
                    "yay " +
                        msg.author.toString() +
                        ", you typed it first in " +
                        time +
                        "ms." +
                        (tc > 1
                            ? "\nyour trophies this session: " + "🏆".repeat(tc)
                            : " here is your prize: 🏆")
                );
                await msg.react("🏆");
            });
            return;
        }
        let atcount = msg.content.split(client.user!.id).length - 1;
        await msg.reply(
            "dont at me im busy" + new Array(atcount).fill(" >:(").join("")
        );
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

client.on("messageReactionAdd", async (rxn, usr) => {
    if (rxn.message.channel.id === channelIDs.ticketmakr) {
    }
    console.log(rxn, usr);
});

// client.on("");

// Watch for rank reaction in #rank requests
// Create a ticket channel (max 1 per person)
// log all messages+images into a rank history channel
