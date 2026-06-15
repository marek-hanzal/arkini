import { Context } from "effect";
import type { ArkiniDatabase, ArkiniTransaction } from "~/v0/database/local/db";

export interface KyselyContext {
	kysely: ArkiniDatabase | ArkiniTransaction;
	isTransaction: boolean;
}

export class KyselyContextFx extends Context.Tag("KyselyContextFx")<
	KyselyContextFx,
	KyselyContext
>() {
	//
}
