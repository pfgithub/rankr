import * as discord from "discord.js";
import * as secret from "./secret.json";
import * as game from "./gamelib";
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

function unreachable() {
    throw new Error("unreachable");
}

const BlockEmojis = { stone: "⬛", air: "🟦", grass: "🟩", dirt: "🟫" };
type Block = keyof typeof BlockEmojis;
type Pos = [number, number];

function mc_worldgen(): game.Board<Block> {
    return game.newBoard<Block>(7, 7, (x, y) => {
        if(x > 4) y -= 1;
        if (y > 4) return "stone";
        if (y > 2) return "dirt";
        if (y > 1) return "grass";
        return "air";
    });
}

type MC = { player: Pos; board: game.Board<Block> };

function mc_gravity(mc: MC) {
    let rp = mc.board.search(
        mc.player,
        (tile, x, y) => {
            if (tile !== "air") return "previous";
            return [x, y + 1];
        },
        "start"
    );
    mc.player = [rp.x, rp.y];
}

function mc_boardrender(mc: MC) {
    return (
        "minecraft\n" +
        mc.board.render((tile, x, y) => {
            if (mc.player[0] === x && mc.player[1] === y)
                return "<:normalpot:407696469722791937>";
            return BlockEmojis[tile];
        }) +
        "\nuse wasd to move and say `end` to stop"
    );
}

async function* colectrgen(collryt: discord.MessageCollector) {
    let over = false;
    collryt.once("end", () => (over = true));
    let msgs = game.oneway<discord.Message>();
    collryt.on("collect", msg => msgs.write(msg));
    while (!over || msgs.hasNext()) {
        let msg = await msgs.read();
        yield msg;
    }
    console.log("\n\n\nOVER\n\n\n");
    msgs.close();
}

function mc_moveplayer(mc: MC, dir: [number, number]) {
    let rp = mc.board.search(
        mc.player,
        (tile, x, y, dist) => {
            if (dist >= 1) return tile === "air" ? "current" : "previous";
            return [x + dir[0], y + dir[1]];
        },
        "start"
    );
    mc.player = [rp.x, rp.y];
}

async function minecraftCommand(msg: discord.Message) {
    if (msg.channel.type === "dm") unreachable();

    let mc: MC = { board: mc_worldgen(), player: [3, 0] };
    mc_gravity(mc);

    const game = await msg.channel.send(mc_boardrender(mc));
    const collectr = new discord.MessageCollector(
        msg.channel as discord.TextChannel,
        m => m.author.id === msg.author.id
    );
    for await (let message of colectrgen(collectr)) {
        if (message.content === "end") {
            collectr.stop();
            continue; // possible to send message after end with the right timing
        }
        let dirs: { [key: string]: [number, number] } = {
            a: [-1, 0],
            d: [1, 0],
            w: [0, -1],
            s: [0, 1],
            wa: [-1, -1],
            aw: [-1, -1],
            wd: [1, -1],
            dw: [1, -1],
            sa: [-1, 1],
            as: [-1, 1],
            sd: [1, 1],
            ds: [1, 1]
        };
        if (dirs[message.content]) {
            await message.delete();
            mc_moveplayer(mc, dirs[message.content]);
            mc_gravity(mc);
            await game.edit(mc_boardrender(mc));
        }
    }
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
    if (msg.channel.parent?.id !== channelIDs.activeTicketsCategory) return; // wrong channel nope
    await getChannel(channelIDs.transcripts).send(
        msg.author.toString() + ": " + msg.content,
        msg.embeds[0] ? { embed: msg.embeds[0], ...msgopts } : msgopts
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
