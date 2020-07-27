import * as discord from "discord.js";
import * as secret from "./secret.json";

import { minecraftCommand } from "./minecraft";

import { promises as fs } from "fs";
const words = require("./words.json") as string[];

const client = new discord.Client({
    partials: ["MESSAGE", "CHANNEL", "REACTION"]
});
client.login(secret.token);

const channelIDs = {
    activeTicketsCategory: "735251571260260414",
    transcripts: "735969996773261404",
    ticketmakr: "735250354450464808",
    ticketLogs: "735251434836197476"
};

function getChannel(chid: string): discord.TextChannel {
    return client.channels.resolve(chid) as discord.TextChannel;
}
const msgopts: discord.MessageOptions = {
    allowedMentions: { parse: [], roles: [], users: [] }
};

let localtrophycount: { [key: string]: number } = {};
let forcewords: { [key: string]: string[] } = {};
const forcewordCost = 5;

function getforcewords(userid: string) {
    if (!forcewords[userid]) forcewords[userid] = [];
    return forcewords[userid];
}

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

function trophyprint(count: number) {
    if (count === 0) return "0";
    return "🏆".repeat(count);
}

client.on("message", async msg => {
    if (msg.partial) await msg.fetch();
    if (msg.channel.type === "dm") {
        if (!msg.author.bot) {
            if (msg.content.startsWith("forceword ")) {
                let word = msg.content.replace("forceword ", "");
                if (word.length > 40)
                    return await msg.reply("thats too long :(");

                let trophies = localtrophycount[msg.author.id] || 0;
                {
                    if (trophies < forcewordCost)
                        return await msg.reply(
                            "you need " +
                                forcewordCost +
                                " trophies but you only have " +
                                trophyprint(trophies)
                        );
                    trophies -= forcewordCost;
                    localtrophycount[msg.author.id] = trophies;
                }

                getforcewords(msg.author.id).push(word);
                await msg.reply(
                    "ok ill force that word next time you do randomword. also btw I took away " +
                        forcewordCost +
                        " trophies from you, you have " +
                        trophyprint(trophies) +
                        " now.",
                    msgopts
                );
                return;
            }
            await msg.reply("dont pm me :(");
        }
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
        if (msg.content.includes("minecraft")) {
            await minecraftCommand(msg);
            //return await msg.reply("not implemented yet sorry :(");
            return;
        }
        if (msg.content.includes("randomword")) {
            let rword =
                getforcewords(msg.author.id).shift() ||
                words[Math.floor(Math.random() * words.length)];
            await msg.channel.send("quick type the word", {
                files: [
                    {
                        name: "type.png",
                        attachment:
                            "https://dummyimage.com/400x100/000/fff.png&text=" +
                            encodeURIComponent(rword)
                    }
                ],
                ...msgopts
            });
            const start = new Date().getTime();
            const collectr = new discord.MessageCollector(
                msg.channel as discord.TextChannel,
                m => m.content.toLowerCase() === rword.toLowerCase(),
                { time: 10_000 }
            );
            msg.channel.startTyping();
            let guessed = false;
            collectr.on("end", async () => {
                if (guessed) return;
                msg.channel.stopTyping();
                let mytrphies = (localtrophycount[client.user!.id] || 0) + 1;
                localtrophycount[client.user!.id] = mytrphies;
                await msg.channel.send(rword, msgopts);
                await msg.channel.send(
                    "ha! i win\ny'all'r too slow type faster next time :)\nmy trophy collection: " +
                        trophyprint(mytrphies)
                );
            });
            collectr.on("collect", async msg_ => {
                const msg = msg_ as discord.Message;
                msg.channel.stopTyping();
                guessed = true;
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
                            ? "\nyour trophies this session: " + trophyprint(tc)
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
    if (msg.channel.parent?.id === channelIDs.activeTicketsCategory) {
        // log
        await getChannel(channelIDs.transcripts).send(
            "<@" +
                ticketOwnerID(msg.channel as discord.TextChannel) +
                ">'s ticket: [" +
                msg.author.toString() +
                "]: " +
                msg.content,
            msg.embeds[0] ? { embed: msg.embeds[0], ...msgopts } : msgopts
        );
        for (let atchmnt of msg.attachments) {
            await getChannel(channelIDs.transcripts).send(
                "Attachment: " + atchmnt[1].url,
                msgopts
            );
        }
        // @ score verifiers maybe
        if (!msg.author.bot && (msg.channel.topic || "").startsWith("~")) {
            await msg.channel.setTopic(
                (msg.channel.topic || "").replace("~", "+"),
                "mention score verifiers"
            );
            await msg.channel.send("<@&407798614140780558>");
        }
        return;
    }
});

function ticketOwnerID(channel: discord.TextChannel): string {
    let creatorid = ((channel.topic || "").match(/<@!?([0-9]+?)>/) || [
        "",
        "ERNOID"
    ])[1];
    return creatorid;
}

async function closeTicket(
    channel: discord.TextChannel,
    closer: discord.User | discord.PartialUser,
    inactivity: boolean = false
) {
    if (channel.deleted) return;
    if ((channel as any).__IS_CLOSING) return;
    (channel as any).__IS_CLOSING = true;

    await channel.setName("closing-" + channel.name);

    let forinactive = inactivity ? " for inactivity" : "";
    await channel.send(
        "Ticket closed by " +
            closer.toString() +
            forinactive +
            ". This channel will be deleted in 60 seconds.\n" +
            "⎯".repeat(30),
        msgopts
    );
    // fetch last 1000 messages
    // make html page
    // save in #transcripts (735250062635958323)
    // link in closed message below
    // https://tickettool.xyz/direct?url=UPLOADEDFILELINK
    await ticketLog(
        ticketOwnerID(channel),
        "Closed by " + closer.toString() + forinactive,
        "red"
    );

    await new Promise(r => setTimeout(r, 60 * 1000));
    await channel.delete("closed by " + closer.toString());
    (channel as any).__IS_CLOSING = false;
}

async function createTicket(creator: discord.User | discord.PartialUser) {
    let cat = (getChannel(
        channelIDs.activeTicketsCategory
    ) as any) as discord.CategoryChannel;
    let ncperms: discord.OverwriteResolvable[] = cat.permissionOverwrites.array();
    ncperms.push({ id: creator.id, allow: ["VIEW_CHANNEL"] });
    let channelName = "ticket-" + creator.id;
    let foundch = cat.guild.channels.cache.find(
        ch => ch.name === channelName
    ) as discord.TextChannel;
    if (foundch) {
        await foundch.send(
            creator.toString() + ", Send your rank request proof here."
        );
        return;
    }
    let cre8tedchan = await cat.guild.channels.create(channelName, {
        parent: cat,
        permissionOverwrites: ncperms,
        topic: "~ " + creator.toString() + "'s rank request"
    });
    let hedrmsg = await cre8tedchan.send(
        creator.toString() +
            ", Send your proof here. For more information on what ranks are available and what proof is need, check <#" +
            channelIDs.ticketmakr +
            ">."
    );
    await hedrmsg.react("🗑️");
    setTimeout(async () => {
        if (cre8tedchan.deleted) return;
        if ((cre8tedchan.topic || "").startsWith("~")) {
            await cre8tedchan.send("1 hour inactivity");
            await closeTicket(cre8tedchan, creator, true);
        }
    }, 60 * 60 * 1000);

    await ticketLog(creator.id, "Created ticket", "green");
}

const colors = { green: 3066993, red: 15158332 };

async function ticketLog(
    actionerID: string,
    message: string,
    color: keyof typeof colors
) {
    let rylActioner = client.users.resolve(actionerID);

    let logsChannel = getChannel(channelIDs.ticketLogs);
    let logEmbed = new discord.MessageEmbed();
    if (rylActioner)
        logEmbed.author = {
            name: rylActioner.username + "#" + rylActioner.discriminator,
            iconURL: rylActioner.displayAvatarURL({ dynamic: true, size: 32 })
        };
    else
        logEmbed.author = {
            name: "id: " + actionerID
        };
    logEmbed.color = colors[color];
    logEmbed.description = message;
    await logsChannel.send("<@" + actionerID + ">'s ticket", {
        ...msgopts,
        embed: logEmbed
    });
}

client.on("messageReactionAdd", async (rxn, usr) => {
    if (usr.bot) return;
    if (
        (rxn.message.channel as discord.TextChannel).parent?.id ===
            channelIDs.activeTicketsCategory &&
        rxn.emoji.name === "🗑️"
    ) {
        await closeTicket(rxn.message.channel as discord.TextChannel, usr);
        return;
    }
    if (rxn.message.channel.id === channelIDs.ticketmakr) {
        if (rxn.partial) await rxn.fetch();
        if ((rxn.count || 100) <= 1) {
            await rxn.message.react(rxn.emoji);
            await rxn.users.remove(usr.id);
            return;
        }
        await rxn.users.remove(usr.id);
        await createTicket(usr);
        return;
    }
    // console.log(rxn, usr);
});

// client.on("");

// Watch for rank reaction in #rank requests
// Create a ticket channel (max 1 per person)
// log all messages+images into a rank history channel
