import { readFile } from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameConfigFromArkiniPack } from "~/config/pack/createGameConfigFromArkiniPack";

const gunzipAsync = promisify(gunzip);

export const loadGameConfigPackFromFile = async (path: string): Promise<GameConfig> =>
	createGameConfigFromArkiniPack(new Uint8Array(await gunzipAsync(await readFile(path))));
