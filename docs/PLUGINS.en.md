# StoryTree Plugin API 1

Create a UTF-8 JSON file with the `.storytree-plugin.json` extension. The [Scene Counter example](../examples/scene-count.storytree-plugin.json) reads the active scene and reports its node count.

1. Set `apiVersion` to `1`, choose a unique lowercase `id`, and give the package its own `version`.
2. Declare `project.read` to receive a project snapshot. Define an action with an ID, title, and context such as `scene`.
3. Put JavaScript in the `source` string. Pass an object to `StoryTree.register`, using each action ID as the corresponding function name. The function receives `sceneId`, `nodeId`, `language`, `inputs`, and the project snapshot when permitted.
4. Open **Plugins → Install or update plugin** in StoryTree. Select the file, enable the package, choose your action, and click **Run**.
5. Keep the same ID and raise the package version to test an update. StoryTree 1.2.0 uses host API 1.

An action can return `{message: "..."}` to show a report or `links` to navigate to nodes. A package with `project.write` can also return `commands`. StoryTree previews the proposed edits for user approval before saving them. Node-scoped actions require a single node selection.

See the [complete API reference in Chinese](PLUGINS.md), the [scene review example](../examples/scene-review.storytree-plugin.json), and the [command allowlist](../plugin-api.js).
