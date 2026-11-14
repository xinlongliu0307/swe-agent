export interface Logger {
  debug(msg: string): void;
}

export const silentLogger: Logger = { debug: () => {} };
