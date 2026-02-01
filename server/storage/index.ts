import { DbStorage } from "./table/db-storage";
import { sqlite } from "../db";

export let storage: DbStorage;

export function initializeStorage(sqliteInstance: any) {
  storage = new DbStorage(sqliteInstance);
}