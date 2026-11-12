# StoryTree 插件 API 1

插件由单个 UTF-8 JSON 文件分发，推荐使用 .storytree-plugin.json 后缀。在 StoryTree 顶部打开「插件 → 安装或更新插件」，选中该文件，再在列表中启用。插件的安装与启用状态保存在应用的 data/plugins.json，对本应用目录打开的各个项目生效。

更新同一个插件时，保留 id 并提高插件的 version。更新会保留原启用状态，新增权限时需要重新启用。StoryTree 1.2.0 使用宿主 API 1，兼容此 API 的插件可以独立安装、停用、卸载和升级。

可先用[场景计数示例](../examples/scene-count.storytree-plugin.json)练习安装和运行。另有[英文快速入门](PLUGINS.en.md)。

## 插件包

文件需小于等于 256 KiB。下例在插件菜单中添加一个读取当前场景名称的操作。

    {
      "apiVersion": 1,
      "id": "author.scene-name",
      "version": "1.0.0",
      "name": "当前场景",
      "description": "显示当前场景名称",
      "permissions": ["project.read"],
      "actions": [{"id": "show", "title": "显示场景", "context": "scene"}],
      "source": "StoryTree.register({show({project,sceneId}) { return {message: project.scenes.find(scene => scene.id === sceneId).name}; }});"
    }

- id 用小写英文开头，可以含小写字母、数字、点和连字符。version 用三个数字表示，例如 1.2.0。
- actions 定义插件菜单中的操作，id 必须在包内唯一，title 是按钮标题。context 可取 project、scene 或 node。node 操作需要先在剧情画布选中一个节点。
- 每个操作可声明 description 和 fields。每个输入有 id、label、type，可设置 required。type 可取 text、multiline、number、boolean 或 select。select 提供 choices 数组，每项为 {"value":"值","label":"显示文字"}。
- source 是 JavaScript 字符串。通过 StoryTree.register 注册以操作 ID 为键的函数。函数可同步返回结果，也可返回 Promise。

## 上下文与返回值

操作接收一个对象，其中包括 apiVersion、language、sceneId、nodeId、inputs。language 为 zh-CN 或 en，未选中单个节点时 nodeId 为 null。inputs 以字段 ID 为键，文本及选项是字符串，数字字段是数值或 null，复选框是布尔值。

声明 project.read 后，上下文还包含 project，结构与 StoryTree 项目导出一致。插件可以在自己的运行环境中处理这份副本。声明 project.write 后，返回值可以包含 commands，应用会显示命令预览，由用户确认后按同一批次保存。项目在预览后变化时，需要重新运行插件。

返回值可以包含以下字段。

- message 为显示在操作窗口中的纯文本。
- links 为可跳转的节点链接数组，每项为 {"nodeId":"内部节点 ID","label":"显示文字"}。
- commands 为项目命令数组，每项为 {"type":"outline.create","args":{"title":"检查清单","text":"待完善的节点"}}。支持的命令可在源码 plugin-api.js 的 COMMANDS 中查看。命令参数沿用 StoryTree 的项目命令格式。可通过 AI / MCP 中的 storytree://schema 查看地图、角色变量和大纲等字段。

每次操作最多返回 100 条节点链接和 100 项命令，序列化结果最多 524,288 个字符。插件脚本只在用户运行操作时启动，执行超时后会终止。脚本运行在隔离的浏览器 Worker 中，项目读写由宿主按权限提供。

此 API 提供菜单操作、输入表单、文本报告、节点跳转和项目命令。若功能需要新的主界面扩展点或新的项目命令，应先扩展宿主 API。

安装程序附带 examples/scene-review.storytree-plugin.json。在「插件」中点击「安装示例插件」，即可查看场景检查和生成大纲的完整示例。
