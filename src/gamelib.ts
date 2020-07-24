/// pass data async
/// stream.write()
/// await stream.read()
/// adapted from https://github.com/pfgithub/advent-of-code-2019/blob/master/solutions/_defaults/_defaults.0.ts
export function oneway<T>(): {
    read: () => Promise<T>;
    write: (v: T) => void;
    close: () => void;
    hasNext: () => boolean;
} {
    const stream: T[] = [];
    let waitingnow: ((v: T) => void) | undefined;
    let over = false;
    return {
        read: () => {
            return new Promise(resolve => {
                if (stream.length > 0) {
                    return resolve(stream.shift());
                } else {
                    waitingnow = v => {
                        waitingnow = undefined;
                        resolve(v);
                    };
                }
            });
        },
        write: v => {
            if (over) throw new Error("cannot write to closed oneway");
            if (waitingnow) {
                waitingnow(v);
            } else {
                stream.push(v);
            }
        },
        close: () => {
            over = true;
            if (stream.length > 0)
                throw new Error("oneway closed while items are in stream");
        },
        hasNext: () => {
            return stream.length !== 0;
        }
    };
}

export const ratelimit = (frequency: number & { __unit: "ms" }) => {
    let timeout: NodeJS.Timeout | undefined;
    let nextExec: undefined | (() => Promise<void>);
    return (action: () => Promise<void>) => {
        if (timeout) {
            nextExec = action;
            return;
        }
        action();
        timeout = setTimeout(() => {
            timeout = undefined;
            if (nextExec) nextExec();
        }, frequency);
    };
};

export function unit(v: number, name: "ms" | "sec" | "min") {
    if (name === "min") return (v * 1000 * 60) as number & { __unit: "ms" };
    if (name === "sec") return (v * 1000) as number & { __unit: "ms" };
    if (name === "ms") return v as number & { __unit: "ms" };
    throw new Error("invalid unit " + name);
}

export type Board<TileData> = {
    get(x: number, y: number): TileData | undefined;
    set( // or mutate tile
        x: number,
        y: number,
        tile: TileData
    ): void;
    fill(tile: (tile: TileData, x: number, y: number) => TileData): void;
    render(draw: (tile: TileData, x: number, y: number) => string): string;
    forEach(cb: (tile: TileData, x: number, y: number) => void): void;
    filter(
        compare: (tile: TileData, x: number, y: number) => boolean
    ): { tile: TileData; x: number; y: number }[];
    search: <ZM extends "undefined" | "start">(
        startingPosition: Pos,
        cb: (
            tile: TileData,
            x: number,
            y: number,
            dist: number
        ) => Pos | "current" | "previous",
        zeroMode?: ZM
    ) =>
        | { x: number; y: number; distance: number }
        | (ZM extends "start" ? never : undefined);
};
export type Pos = [number, number];
// this should just be a class instead of this function thing
export function newBoard<TileData>(
    w: number,
    h: number,
    fill: (x: number, y: number) => TileData // to make copies, x and y are unnecessary but why not
): Board<TileData> {
    const tiles: TileData[][] = [];
    for (let y = 0; y < h; y++) {
        tiles[y] = [];
        for (let x = 0; x < w; x++) {
            tiles[y][x] = fill(x, y);
        }
    }

    const board: Board<TileData> = {
        // returns undefined when out of map
        get(x, y) {
            return tiles[y]?.[x];
        },
        set(x, y, tile) {
            tiles[y][x] = tile;
        },
        fill(tile) {
            board.forEach((tilec, x, y) => {
                board.set(x, y, tile(tilec, x, y));
            });
        },
        render(draw) {
            return tiles
                .map((row, y) =>
                    row.map((tile, x) => draw(tile, x, y)).join("")
                )
                .join("\n");
        },
        forEach(cb) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    cb(board.get(x, y)!, x, y);
                }
            }
        },
        filter(filtration) {
            const results: { tile: TileData; x: number; y: number }[] = [];
            board.forEach((tile, x, y) => {
                if (filtration(tile, x, y)) results.push({ tile, x, y });
            });
            return results;
        },
        search(startingPosition, cb, zeroMode) {
            let [cx, cy] = startingPosition;
            let [x, y] = startingPosition;
            let i = 0;
            while (true) {
                if (i > 1000)
                    throw new Error("Potentially infinite find!:(passed 1000)");
                const result = // in zig this could be a normal if statement instead of a ternary thing. that is the obvious way to do it, why doesn't every language do it that way
                    cx >= w || cx < 0 || cy >= h || cy < 0
                        ? "previous" // search will now automatically fail when off board
                        : cb(tiles[cy][cx], cx, cy, i);
                if (result === "previous")
                    if (i === 0 && zeroMode !== "start")
                        return undefined as any;
                    else return { x, y, distance: i };
                [x, y] = [cx, cy];
                i++;
                if (result === "current") return { x, y, distance: i };
                [cx, cy] = result;
            }
        }
    };

    return board;
}
