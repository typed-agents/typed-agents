export class Logger {

  private static now() {
    return new Date().toISOString();
  }

  static info(...args: any[]) {
    console.log(`[INFO ${this.now()}]`, ...args);
  }

  static warn(...args: any[]) {
    console.warn(`[WARN ${this.now()}]`, ...args);
  }

  static error(...args: any[]) {
    console.error(`[ERROR ${this.now()}]`, ...args);
  }

}