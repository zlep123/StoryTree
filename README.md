# StoryTree

StoryTree is a portable Windows editor for game scripts and branching narratives. Build a story on a node canvas, reuse characters and items across scenes, and preview how events and choices change a route.

**[Download for Windows (x64)](https://github.com/zlep123/StoryTree/releases/download/v1.0.0/StoryTree-1.0.0-win-x64.zip)** · [Release notes and checksum](https://github.com/zlep123/StoryTree/releases/tag/v1.0.0) · [中文使用说明](docs/README.zh-CN.md)

![StoryTree's node canvas with the asset library on the left and branching Story Tree on the right](docs/canvas.png)

## Quick start

1. Extract the Windows ZIP to a folder you can write to and double-click `StoryTree.exe`. Keep the extracted files together. The package includes its runtime.
2. Try the built-in *A Letter from Mist Harbor* demo. To start your own project, click the story title and choose **New Blank Story**. You can also open a `.storytree.json` file with **Open**.
3. Right-click the canvas or choose **Add Node**. Select a node to edit its name, text, and story date in the inspector. To connect nodes, click the source output on the right and then the destination input on the left. Dialogue, monologue, and event nodes can have multiple outputs.
4. Drag character and item cards from the asset library into a node. Click **Simulate** to choose a route and inspect how the characters and inventory change.
5. Open **Story Tree** in the canvas toolbar. **Branches** shows parallel routes, and **By Date** lists nodes chronologically across scenes. Click a card to locate the node on the canvas.

Use **Settings** at the bottom left to switch between English and Simplified Chinese and adjust fonts. Hold **Space** and drag to pan, and scroll to zoom. The lower-right minimap shows the current viewport. **Fit Canvas** frames the whole scene.

## What you can build

| Feature | How it works |
| --- | --- |
| **Six node types** | Dialogue, monologue, condition, jump, event, and label. Press **Enter** to add a dialogue line and **Tab** to select a speaker. |
| **Reusable assets** | Characters carry skills, attributes, items, and tags. Item cards can be stacked in inventories. Groups support batch changes and dragging several characters into a scene or node. |
| **Scene snapshots** | A character can have independent starting state in each scene. Jump nodes connect to targets across scenes or dates. |
| **Stateful events** | Record pending changes for battles, trades, and custom events. A following condition can roll back the whole event or changes involving selected characters. |
| **Branch and date views** | Inspect the story graph, sort nodes by story date, and jump from the Story Tree to the canvas. Dates can be typed or picked with year, month, and day wheels. |
| **Search and local saves** | Search across the project with **Ctrl+F**. Edits save automatically, and **Export** saves a portable project copy. |

The app stores the current project at `data/story.storytree.json` beside the executable, with recent backups in `data/backups`. To keep separate projects, export each one as its own `.storytree.json` file.

## Connect an AI agent

Open **AI / MCP** in StoryTree to get the configuration for your actual installation path. The bundled `StoryTree.MCP.exe` is a local stdio MCP server. Compatible clients can read and edit the project, connect nodes, simulate a route, and inspect the story timeline.

For example, add this block to the Codex `config.toml` and replace the path with your own installation:

```toml
[mcp_servers.storytree]
command = 'C:\Apps\StoryTree\StoryTree.MCP.exe'
args = []
```

For a client that accepts JSON:

```json
{
  "mcpServers": {
    "storytree": {
      "command": "C:\\Apps\\StoryTree\\StoryTree.MCP.exe",
      "args": []
    }
  }
}
```

Restart the client after adding the configuration. The MCP and desktop app share the same local project. The `storytree://schema` resource documents the data model and event operations.

## Build from source

Use Windows x64 with Node.js 22.12 or newer and the Windows .NET Framework C# compiler. From the repository root:

```powershell
npm ci
npm test
npm start
```

Run `npm run build` to produce the portable app under `dist/StoryTree-1.0.0-win-x64`. A custom output directory can be supplied with `npm run build -- <directory>`. The build includes the desktop executable, MCP launcher, example projects, and runtime notices. The GitHub Release ZIP contains the runnable app, while GitHub's generated source archives contain the tagged repository.

StoryTree was inspired by Arrow's node-canvas workflow. Electron and Chromium notices ship in the Windows package.
