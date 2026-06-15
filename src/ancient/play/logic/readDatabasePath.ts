import { readDatabasePathFx } from "../fx/readDatabasePathFx";
import { runEffect } from "./runEffect";

export const readDatabasePath = () => runEffect(readDatabasePathFx());
