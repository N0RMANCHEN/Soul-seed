import { runMemoryStoreSql } from "./memory_store.js";

export interface MemoryStoreDriver {
  runSql(rootPath: string, sql: string): Promise<string>;
}

export class SqliteMemoryStoreDriver implements MemoryStoreDriver {
  async runSql(rootPath: string, sql: string): Promise<string> {
    return runMemoryStoreSql(rootPath, sql);
  }
}

let defaultDriver: MemoryStoreDriver = new SqliteMemoryStoreDriver();

export function getMemoryStoreDriver(): MemoryStoreDriver {
  return defaultDriver;
}

export function setMemoryStoreDriver(driver: MemoryStoreDriver): void {
  defaultDriver = driver;
}
