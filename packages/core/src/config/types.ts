import { join } from "node:path";
import { homedir } from "node:os";
import type { z } from "zod";
import { SecurityModeSchema } from "./schema.js";
import { CONFIG_DIR_NAME, DB_NAME } from "./constants.js";

export type SecurityMode = z.infer<typeof SecurityModeSchema>;

export const CONFIG_DIR = join(homedir(), ".config", CONFIG_DIR_NAME);
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const DB_PATH = join(CONFIG_DIR, DB_NAME);
export const RUNTIME_PATH = join(CONFIG_DIR, "runtime.json");
