# StoryTree

StoryTree is a portable Windows editor for game scripts and branching narratives which was inspired by Arrow 3.1. Build a story on a node canvas, reuse characters and items across scenes, and preview how events and choices change a route.

**[Download StoryTree 1.2.2 for Windows (x64)](https://github.com/zlep123/StoryTree/releases/download/v1.2.2/StoryTree-1.2.2-win-x64.zip)** · [1.2.2 release notes and checksum](https://github.com/zlep123/StoryTree/releases/tag/v1.2.2) · [中文使用说明](docs/README.zh-CN.md)

[Two-minute hands-on tutorial, Chinese and English](https://github.com/zlep123/StoryTree/releases/download/v1.2.0/StoryTree-1.2.0-Tutorial-ZH-EN.mp4) · [Original 1.2.0 feature and plugin video](https://github.com/zlep123/StoryTree/releases/download/v1.2.0/StoryTree-1.2.0-Demo-ZH-EN.mp4)

![StoryTree's node canvas with the asset library on the left and branching Story Tree on the right](docs/canvas.png)

## What's new in 1.2.2

- Use the trash icon on a location card in the asset library or map sidebar to delete it from the project. The confirmation lists affected sublocations, storyline assignments, and map layouts. Use **Ctrl+Z** to undo.
- When viewing sublocations, the current location also has edit and delete controls. **Remove from map** clears the placement on that map.

## What's new in 1.2.0

- The node inspector, expanded dialogue editor, and outline editor have separate **Find** and **Replace** controls. The **Replace** button beside project search previews matches across the current scene or the whole project. Select the fields to change and apply the batch. One undo restores the selected edits.
- The scene map supports drag selection and group movement. Use **Map Layers** to hide or lock the background, locations and routes, characters, or objects. StoryTree saves the layer preferences locally.
- The release includes TXT script import, Excel card import, a segmented outline editor, character variables, and an updated dialogue log. It also includes the local MCP launcher and **Plugin API 1**, with a [Scene Counter example](examples/scene-count.storytree-plugin.json) and [plugin development guide](docs/PLUGINS.en.md).

The [1.2.0 release notes](https://github.com/zlep123/StoryTree/releases/tag/v1.2.0) and [original 1.0.0 release notes](https://github.com/zlep123/StoryTree/releases/tag/v1.0.0) record both public releases. The [original English guide](https://github.com/zlep123/StoryTree/blob/9ec1537e92521482caec6d63242f7cd18b4ba9d4/README.md) and [original Chinese guide](https://github.com/zlep123/StoryTree/blob/9ec1537e92521482caec6d63242f7cd18b4ba9d4/docs/README.zh-CN.md) describe the 1.0 interface.

## Quick start

1. Extract the Windows ZIP to a folder you can write to and double-click `StoryTree.exe`. Keep the extracted files together. The package includes its runtime.
2. Try the built-in *A Letter from Mist Harbor* demo. To start your own project, click the story title and choose **New Blank Story**. You can also open a `.storytree.json` file with **Open**.
3. Right-click the canvas or choose **Add Node**. Select a node to edit its name, text, story date, and location in the inspector. To connect nodes, click the source output on the right and then the destination input on the left. Dialogue, monologue, and event nodes can have multiple outputs.
4. Drag character and item cards from the asset library into a node. Click **Simulate** to choose a route and inspect how the characters and inventory change.
5. Open **Story Tree** in the canvas toolbar. **Branches** shows parallel routes, **Story overview** reads the connected scenes in sequence, and the outline tab holds your plan. Use date and location filters to narrow the view. Click a card to locate its node on the canvas.

Use **Settings** at the bottom left to switch between English and Simplified Chinese, adjust interface and node fonts, set the zoom level for the compact node overview, and check for updates. Hold **Space** and drag to pan, and scroll to zoom. The lower-right minimap shows the current viewport. **Fit Canvas** frames the whole scene. Click a scene card's name in the asset library or inspector to edit it. The card also has separate controls to open the canvas and map. Double-click a canvas tab to open scene settings.

### Editing and deleting project content · 1.2.1

Scene, character, item, location, group, item set, concept art, and outline editors have a **Delete** button. The confirmation lists affected content. Use **Undo** or **Ctrl+Z** to restore the deletion as one action.

- Deleting a scene removes its nodes, internal connections, map layouts, and scene character snapshots. It clears jumps and rollback targets pointing into the scene. The project keeps at least one scene.
- Deleting a location moves its children up one level, clears its assignment on nodes and outlines, and removes its map layout and related areas and routes. Deleting a group leaves its cards in the library.
- Characters and items referenced by story data are protected. Item sets used by other sets and groups referenced by story changes are also protected. Text links in outlines remain readable and show when the target has been removed.

## What you can build

| Feature | How it works |
| --- | --- |
| **Six node types** | Dialogue, monologue, condition, jump, event, and label. Press **Enter** to continue a dialogue line. In manual mode, use **Tab** to switch speakers in the picker. |
| **Reusable assets** | Characters carry skills, attributes, items, and tags. Item cards can be stacked in inventories. Groups support batch changes and dragging several characters into a scene or node. Item presets bundle reusable quantities for a character's inventory. |
| **Scene snapshots** | A character can have independent starting state in each scene. Jump nodes connect to targets across scenes or dates. |
| **Stateful events** | Record pending changes for battles, trades, and custom events. A following condition can roll back the whole event or changes involving selected characters. |
| **Branches, dates, and outlines** | Inspect the story graph, filter it by date and location, and jump from the Story Tree to the canvas. Dates can be typed or picked with year, month, and day wheels. |
| **Search and local saves** | Use **Ctrl+F** outside an editor to search the project. Edits save automatically, **Save** commits pending edits, and **Export** saves a portable project copy. |

### Dialogue, events, and character variables

- Set a dialogue node's default speakers and turn order in the inspector. Each line can use its own rule. **Finish and continue** or **Enter** inserts a new line with that line's rule. Use **Shift+Enter** to break a line inside the same entry.
- Click **Expand** for a larger single-line editor. **Edit dialogue log** lets you edit all the dialogue in a dialogue or event node. Use a character ID followed by a colon for each entry. Leave the ID blank for narration. **Node log** previews or exports the complete text of any node as UTF-8 TXT.
- Event nodes can contain dialogue and pending changes to characters, inventory, skills, or attributes. An event can be followed by a condition that rolls back changes when appropriate. **Simulate** lets you switch conditions or choose a branch and inspect the result.
- A character card has a stable ID and a separate in-game display name. In a node, use **Pending changes → Add change → Character name** to set the name or collect player input. Use **Insert character variable** to reference a field such as a name, skill, or item. Click the resulting link to see its value in context.

### Find and replace

Use **Find** or **Replace** in the inspector, expanded dialogue editor, or outline editor. **Ctrl+F** finds text in the active editor. **Ctrl+H** also shows the replacement field. Use **Replace** for the current match or **Replace all** for the current field.

To edit text across nodes, click **Replace** beside project search. Enter the old and new text, choose the current scene or all scenes, and click **Preview replacements**. Select the fields you want to edit, then click **Replace selected**. The preview preserves character variable references, and outline editing preserves asset links.

### Scene maps, locations, and story outlines

- Create locations in the asset library and assign them to nodes in the inspector or by dragging location cards. A node created inside a location region inherits that location. Child locations can have their own colors and submaps.
- Open **Scene map** from the canvas toolbar. Place locations from the sidebar or by dragging their cards onto the map. Double-click a location to open its submap. Drag an area to move it, resize it from its corner, and use **Connect route** to link places. A gallery image can serve as the background.
- Drag a character card onto the map or choose it in **Place character**. Add rectangles, ellipses, triangles, or **Custom object** images. Right-click objects to copy, duplicate, or delete them. Drag from empty space to box-select placements, hold **Shift** to add to the selection, and drag any selected placement to move the group.
- In **Map Layers**, use **Hide** to change what you see and **Lock** to protect placements while editing other layers. **Map guide** shows the layout on the story canvas.
- Open **Story Tree → Story overview** to read node excerpts along a selected route. Expand the tree to get more room. Create a segmented outline with date and location ranges, and drag node or asset links into its text to navigate back to the source.

### Import scripts, cards, and concept art

- Open **Import Script** to preview a TXT script as scenes, dialogue, and prose nodes. Headings such as `# The Wharf` and lines such as `Raven: Keep the lamp lit.` help identify the structure. A line such as `Date: 1024.04.16` dates the following nodes. Unclear dates can stay undated for review.
- In **Characters** or **Items**, use **Import Excel** to preview cards from a workbook. Start with the included [Excel template](examples/Excel-Import-Template.xlsx). The [TXT example](examples/Mist-Harbor-Script.txt) demonstrates script import.
- Use **Concept Art** to keep reference maps, character designs, and environment images. Images can also be placed on a scene map or exported with the project.

### Project files and backups

The app stores the current project at `data/story.storytree.json` beside the executable, with recent backups in `data/backups` and shared portraits and concept art in `data/media`. To keep separate projects, export each one as its own `.storytree.json` file. To move a working installation, close StoryTree before copying its entire `data` directory. A standalone export includes the images needed by that project.

## Build a plugin

StoryTree 1.2.0 uses **Plugin API 1**. Open **Plugins → Install or update plugin**, select the [Scene Counter example](examples/scene-count.storytree-plugin.json), then enable it and run **Count nodes**. To create your own package, define its ID, version, permissions, actions, and a JavaScript `source` string that calls `StoryTree.register`. See the [English quick start](docs/PLUGINS.en.md) or [中文 API 参考](docs/PLUGINS.md).

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

Run `npm run build` to produce the portable app under `dist/StoryTree-1.2.2-win-x64`. A custom output directory can be supplied with `npm run build -- <directory>`. The build includes the desktop executable, MCP launcher, script and Excel examples, sample plugins, and runtime notices. The GitHub Release ZIP contains the runnable app, while GitHub's generated source archives contain the tagged repository.

When adding a new editable project asset, verify creation, reopening from its normal list, editing and reopening after a restart, and deletion with undo and redo. Decide which dependent data to remove, detach, or protect in the project command layer. The deletion preview and the command should use the same dependency check so both the desktop and local MCP preserve project integrity.

StoryTree was inspired by Arrow's node-canvas workflow. Electron and Chromium notices ship in the Windows package.
