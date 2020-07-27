import * as discord from "discord.js";
import * as secret from "./secret.json";
import htmlMinifier from "html-minifier";
//@ts-ignore
import discordMarkdownAny from "discord-markdown";
type DiscordMarkdownOptions = {
    /// Boolean (default: false), if it should parse embed contents (rules are slightly different)
    embed?: boolean;
    /// Boolean (default: true), if it should escape HTML
    escapeHTML?: boolean;
    /// Boolean (default: false), if it should only parse the discord-specific stuff
    discordOnly?: boolean;
    /// Object, callbacks used for discord parsing. Each receive an object with different properties, and are expected to return an HTML escaped string
    discordCallback?: {
        user?: (id: { id: string }) => string;
        channel?: (id: { id: string }) => string;
        role?: (id: { id: string }) => string;
        emoji?: (animated: boolean, name: string, id: string) => string;
        everyone?: () => string;
        here?: () => string;
    };
    /// Object, maps CSS class names to CSS module class names
    cssModuleNames?: object;
};
const discordMarkdown = discordMarkdownAny as {
    toHTML: (dsmd: string, options?: DiscordMarkdownOptions) => string;
};

import { minecraftCommand } from "./minecraft";

import { promises as fs } from "fs";
import * as fsync from "fs";
const words = require("./words.json") as string[];

const client = new discord.Client({
    partials: ["MESSAGE", "CHANNEL", "REACTION"]
});
client.login(secret.token);

const channelIDs = {
    activeTicketsCategory: "735251571260260414",
    transcripts: "735969996773261404",
    ticketmakr: "735250354450464808",
    ticketLogs: "735251434836197476",
    logfiles: "735250062635958323"
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
        if (msg.content.includes("channellogtest")) {
            let chanmatch = msg.content.match("<#&?([0-9]+?)>");
            await sendChannelLog(
                "NOID",
                chanmatch ? getChannel(chanmatch[1]) : (msg.channel as any),
                msg.channel as any
            );
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

function raw(string: TemplateStringsArray | string) {
    return { __raw: `${string.toString()}` };
}

function templateGenerator<InType>(helper: (str: InType) => string) {
    type ValueArrayType = (InType | string | { __raw: string })[];
    return (
        strings: TemplateStringsArray | InType,
        ...values: ValueArrayType
    ) => {
        if (!(strings as TemplateStringsArray).raw && !Array.isArray(strings)) {
            return helper(strings as InType);
        }
        const result: ValueArrayType = [];
        (strings as TemplateStringsArray).forEach((str, i) => {
            result.push(raw(str), values[i] || "");
        });
        return result
            .map(el =>
                typeof (el as { __raw: string }).__raw === "string"
                    ? (el as { __raw: string }).__raw
                    : helper(el as InType)
            )
            .join("");
    };
}

function escapeHTML(html: string) {
    return html
        .split("&")
        .join("&amp;")
        .split('"')
        .join("&quot;")
        .split("<")
        .join("&lt;")
        .split(">")
        .join("&gt;");
}
const safehtml = templateGenerator((v: string) => escapeHTML(v));
const verifiedbotsvg = safehtml`
    <svg aria-label="Verified Bot" class="botcheck" aria-hidden="false" width="16" height="16" viewBox="0 0 16 15.2">
        <path d="M7.4,11.17,4,8.62,5,7.26l2,1.53L10.64,4l1.36,1Z" fill="currentColor"></path>
    </svg>`;

function emojiHTML(animated: boolean, id: string, name: string) {
    return safehtml`<img class="emoji"
    src="https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}"
    title=":${name}:" aria-label=":${name}:" alt=":${name}:" draggable="false">`;
}

function genLogOneMessage(msg: discord.Message) {
    let bottag = msg.author.bot
        ? safehtml`<span class="bottag">${raw(verifiedbotsvg)}BOT</span>`
        : "";

    let msgContentSafe = discordMarkdown.toHTML(msg.content, {
        discordOnly: false,
        discordCallback: {
            user: ({ id }) => {
                let usrinfo = msg.guild!.members.resolve(id);
                if (usrinfo) {
                    let usrtag =
                        usrinfo.user.username +
                        "#" +
                        usrinfo.user.discriminator;
                    return safehtml`<span class="tag" data-id="${id}"
                    title="${usrtag}">@${usrinfo.displayName}</span>`;
                } else
                    return safehtml`<span class="tag">${"<@!" +
                        id +
                        ">"}</span>`;
            },
            channel: ({ id }) => {
                let chaninfo = msg.guild!.channels.resolve(id);
                if (chaninfo)
                    return safehtml`<span class="tag" data-id="${id}">#${chaninfo.name}</span>`;
                else
                    return safehtml`<span class="tag">${"<#" +
                        id +
                        ">"}</span>`;
            },
            role: ({ id }) => {
                let roleinfo = msg.guild!.roles.resolve(id);
                if (roleinfo) {
                    let roleColor: string | undefined = roleinfo.hexColor;
                    if (roleColor === "#000000") roleColor = undefined;
                    let styletxt = "";
                    if (roleColor)
                        styletxt = `--fg-color: ${roleColor}; --bg-color: ${roleColor}1A; --hl-color: ${roleColor}4d`;
                    return safehtml`<span data-id="${id}" class="tag"
                    style="${styletxt}">@${roleinfo.name}</span>`;
                } else
                    return safehtml`<span class="tag">${"<@&" +
                        id +
                        ">"}</span>`;
            },
            emoji: (animated, name, id) => emojiHTML(animated, name, id),
            everyone: () => safehtml`<span class="tag">@everyone</span>`,
            here: () => safehtml`<span class="tag">@here</span>`
        }
    });

    let reactions: string[] = [];
    for (let rxn of msg.reactions.cache.array()) {
        const emojitxt = rxn.emoji.id
            ? emojiHTML(rxn.emoji.animated, rxn.emoji.id, rxn.emoji.name)
            : safehtml`${rxn.emoji.name}`;
        reactions.push(safehtml`<div class="reaction"
            ><div class="reactionemoji"
            >${raw(emojitxt)}</div
            ><div class="reactioncount"
            >${"" + (rxn.count || "???")}</div
        ></div>`);
    }
    let reactionsText = reactions.length ? "<br />" + reactions.join("") : "";

    let embeds: string[] = [];
    for (let embed of msg.embeds) {
        let mbedtitle = embed.title
            ? safehtml`<div class="embedtitle">${embed.title}</div>`
            : "";
        let mbedesc = embed.description
            ? safehtml`<div class="embedtitle">${embed.description}</div>`
            : "";
        embeds.push(safehtml`<div class="embed" style="--mbed-colr: ${embed.hexColor ||
            "unset"}"
            >${raw(mbedtitle)}${raw(mbedesc)}</div
        >`);
    }
    let embedsText = embeds.length ? "" + embeds.join("") : "";

    let attachments: string[] = [];
    for (let attachment of msg.attachments.array()) {
        if (
            attachment.name &&
            (attachment.name.endsWith(".jpg") ||
                attachment.name.endsWith(".png") ||
                attachment.name.endsWith(".jpeg"))
        ) {
            attachments.push(
                safehtml`<div><img src="${attachment.proxyURL}" class="sizimg" /></div>`
            );
            continue;
        }
        attachments.push(
            safehtml`<div>[attachment] <a href="${
                attachment.url
            }">${attachment.name || "ATCHMNT"}</a></div>`
        );
    }
    let attachmentsText = attachments.length ? attachments.join("") : "";

    let memberColor = msg.member!.displayHexColor;
    if (memberColor === "#000000") memberColor = "undefined as any";
    let authorign = msg.author.username + "#" + msg.author.discriminator;
    return {
        top: safehtml`<div class="message"
            ><img class="profile" src="${msg.author.displayAvatarURL({
                dynamic: true,
                size: 64
            })}"
            /><div class="author" style="color: ${memberColor}"
            title="${authorign}" data-id="${msg.author.id}">
                ${msg.member!.displayName} ${raw(bottag)}</div
            ><div class="msgcontent">`,
        center: msgContentSafe + embedsText + attachmentsText + reactionsText,
        bottom: safehtml`</div></div>`
    };
}

const docTemplate = fsync
    .readFileSync("docgen/template.html", "utf-8")
    .replace(
        "{html|stylesheet}",
        "<style>" + fsync.readFileSync("docgen/style.css", "utf-8") + "</style>"
    );

function genLogMayError(messages: discord.Message[]) {
    // return "TODO";
    let messagesListA = messages
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(msg => {
            try {
                return genLogOneMessage(msg);
            } catch (e) {
                console.log(e);
                return {
                    top: safehtml`<div class="message">`,
                    center: safehtml`error! ${e.toString()}`,
                    bottom: safehtml`</div>`
                };
            }
        });

    let messagesListB: { top: string; center: string; bottom: string }[] = [];
    for (let msg of messagesListA) {
        let latest = messagesListB[messagesListB.length - 1] || {
            top: "",
            center: "",
            bottom: ""
        };
        if (msg.top === latest.top && msg.bottom === latest.bottom)
            latest.center += "<br />" + msg.center;
        else messagesListB.push(msg);
    }
    let messagesListSafe = messagesListB
        .map(msg => msg.top + msg.center + msg.bottom)
        .join("\n");

    // fsync.writeFileSync("___DELETE.html", messagesListSafe, "utf-8");
    return htmlMinifier.minify(
        docTemplate
            .replace("{html|navbar}", "")
            .replace("{html|content}", messagesListSafe)
            .replace("{html|sidebar}", "")
            .replace("{html|pagetitle}", "log")
            .replace("{html|pagetitle}", "log")
    );
}

function genLog(messages: discord.Message[]) {
    try {
        return genLogMayError(messages);
    } catch (e) {
        return `uh oh the log couldn't be generated :(`;
    }
}

async function sendChannelLog(
    ticketOwnerID: string,
    channel: discord.TextChannel,
    sendTo: discord.TextChannel
) {
    sendTo.startTyping();
    let lastMessages = await channel.messages.fetch({ limit: 100 }, false);
    let logtext = genLog(lastMessages.array());
    let logMsg = await sendTo.send("<@" + ticketOwnerID + ">'s '", {
        ...msgopts,
        files: [
            {
                name: "log.html",
                attachment: Buffer.from(logtext)
            }
        ]
    });
    sendTo.stopTyping();
    await logMsg.edit(
        "https://pfg.pw/rankr/view?page=" + logMsg.attachments.array()[0].url
    );
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

    await ticketLog(
        ticketOwnerID(channel),
        "Closed by " + closer.toString() + forinactive,
        "red"
    );

    await sendChannelLog(
        ticketOwnerID(channel),
        channel,
        getChannel(channelIDs.logfiles)
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
    let channelName = "rank-" + creator.id;
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
