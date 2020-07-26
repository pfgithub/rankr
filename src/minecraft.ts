import * as discord from "discord.js";
import * as game from "./gamelib";


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

export async function minecraftCommand(msg: discord.Message) {
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