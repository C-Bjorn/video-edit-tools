#!/usr/bin/env node

import { runServer } from './server.js';

runServer().catch((error) => {
    console.error("Fatal error running MCP server:", error);
    process.exit(1);
});
