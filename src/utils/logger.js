export default (...ns) => {
  const namespace = `[${ns.join(':')}]`;
  return {
    log(...args) {
      if (args.length > 1) {
        console.log(`\x1b[32m✓ \x1b[1m${this || namespace}\x1b[0m`, ...args);
      } else {
        console.log(`\x1b[32m✓ ${this || namespace}\x1b[0m \x1b[2m${args[0] || ''}\x1b[0m`);
      }
    },
    warn(...args) {
      console.warn(`⚠️  \x1b[33m\x1b[1m${this || namespace}\x1b[0m\x1b[33m`, ...args.slice(0, 1), '\x1b[0m', ...args.slice(1));
    },
    error(...args) {
      console.error(`❌ \x1b[31m\x1b[1m${this || namespace}\x1b[0m\x1b[31m`, ...args.slice(0, 1), '\x1b[0m', ...args.slice(1));
    },
  }
}
