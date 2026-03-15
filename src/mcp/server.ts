import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { allTools, handleTool } from './tools.js';

export async function runServer() {
  const server = new Server(
    { name: 'video-edit-tools', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await handleTool(request.params.name, request.params.arguments || {});
      return result;
    } catch (error: any) {
      if (error.message.startsWith('Tool not found:')) {
         throw error;
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ok: false, code: 'PROCESSING_FAILED', error: error.message })
        }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('video-edit-tools MCP server running on stdio');
}
