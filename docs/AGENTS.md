# video-edit-tools Agent Setup Guide

## For Claude Desktop / Cursor

To allow your AI assistant to use deterministic video editing operations natively, configure the Model Context Protocol (MCP) server.

### 1. Claude Desktop Setup

Edit your `claude_desktop_config.json` (found in `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\Claude\` on Windows).

```json
{
  "mcpServers": {
    "video-edit-tools": {
      "command": "npx",
      "args": ["video-edit-tools-mcp"]
    }
  }
}
```

*(Ensure `node` and `npx` are available in your PATH, or provide absolute paths to the node executable)*

### 2. Available Agent Tools

Once connected, your agent will have access to exactly 25 video manipulation utilities:

- **Core**: `video_trim`, `video_concat`, `video_resize`, `video_crop`, `video_change_speed`, `video_convert`, `video_extract_frames`, `video_get_metadata`
- **Visuals**: `video_add_text`, `video_add_subtitles`, `video_composite`, `video_gradient_overlay`, `video_blur_region`, `video_add_transition`
- **Audio**: `video_extract_audio`, `video_replace_audio`, `video_adjust_volume`, `video_mute_section`, `video_transcribe`
- **AI/Filters**: `video_adjust`, `video_apply_filter`, `video_detect_scenes`, `video_generate_thumbnail`
- **Multi-op**: `video_pipeline`, `video_batch`

### 3. Usage Notes for Agents

- **File Paths**: MCP cannot reliably pass binary Buffers over JSON-RPC. Provide *absolute file paths* or *URLs* as inputs to these tools.
- **Output Paths**: The tools generally return JSON objects containing successful output attributes and `savedTo: "/tmp/.../file.mp4"`. You can then read or pass that out path to the next tool.
- **Transcribe First Run**: `video_transcribe` downloads the Whisper base model (~150MB) on the very first run, which may delay that specific call by 10-30 seconds.
