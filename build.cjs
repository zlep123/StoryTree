'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const metadata = require('./package.json');

const root = __dirname;
const runtimeFiles = [
  'character-card-view.js', 'character-import.js', 'core.js', 'excel-import.cjs', 'index.html', 'logo.ico', 'logo.png', 'logo.svg',
  'main.cjs', 'mcp-server.cjs', 'mcp.cjs', 'plugin-api.js', 'plugin-sandbox.js', 'plugin-store.cjs', 'plugin-view.js', 'preload.cjs',
  'project-files.cjs', 'scene-map-view.js', 'script-import.js', 'server.cjs', 'service.cjs',
  'store.cjs', 'story-tree-view.js', 'style.css', 'text-find-replace.js', 'ui.js', 'update.cjs'
];
const supportedLocales=new Set(['en-US.pak','en-GB.pak','zh-CN.pak','zh-TW.pak']);

async function build() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw Error('Build the Windows portable package on Windows x64.');
  }
  const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'StoryTree-' + metadata.version + '-win-x64'));
  if (fs.existsSync(output) && fs.readdirSync(output).length) {
    throw Error('Choose an empty output directory: ' + output);
  }

  const {rcedit} = await import('rcedit');
  fs.mkdirSync(output, {recursive:true});
  const electronDirectory=path.join(root,'node_modules','electron','dist');
  const localeDirectory=path.join(electronDirectory,'locales');
  fs.cpSync(electronDirectory,output,{
    recursive:true,
    filter:file=>path.dirname(file)!==localeDirectory||supportedLocales.has(path.basename(file))
  });
  const executable = path.join(output, 'StoryTree.exe');
  fs.renameSync(path.join(output, 'electron.exe'), executable);

  const appDirectory = path.join(output, 'resources', 'app');
  fs.mkdirSync(appDirectory, {recursive:true});
  for (const file of runtimeFiles) fs.copyFileSync(path.join(root,file),path.join(appDirectory,file));
  const {packages} = require('./package-lock.json');
  for (const [name,info] of Object.entries(packages)) {
    if (name.startsWith('node_modules/') && !info.dev) {
      fs.cpSync(path.join(root,name),path.join(appDirectory,name),{recursive:true});
    }
  }
  fs.mkdirSync(path.join(appDirectory,'examples'),{recursive:true});
  const examples=['Excel-Import-Template.xlsx','Mist-Harbor-Script.txt','scene-review.storytree-plugin.json','scene-count.storytree-plugin.json'];
  for (const name of examples) {
    fs.copyFileSync(path.join(root,'examples',name),path.join(appDirectory,'examples',name));
  }
  const appMetadata = {...metadata};
  delete appMetadata.devDependencies;
  delete appMetadata.scripts;
  fs.writeFileSync(path.join(appDirectory,'package.json'), JSON.stringify(appMetadata,null,2));

  const icon = path.join(root,'logo.ico');
  const numericVersion = metadata.version.split('-')[0];
  const version = {'file-version':numericVersion,'product-version':numericVersion};
  await rcedit(executable,{icon,...version,'requested-execution-level':'asInvoker',
    'version-string':{ProductName:'StoryTree',FileDescription:'StoryTree 故事树',OriginalFilename:'StoryTree.exe'}});
  const launcher = path.join(output,'StoryTree.MCP.exe');
  const compiler = path.join(process.env.WINDIR || 'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  execFileSync(compiler,['/nologo','/target:exe','/platform:anycpu','/optimize+','/out:'+launcher,
    path.join(root,'McpLauncher.cs')],{windowsHide:true});
  await rcedit(launcher,{icon,...version,'version-string':{ProductName:'StoryTree MCP',FileDescription:'StoryTree MCP stdio server'}});

  fs.mkdirSync(path.join(output,'examples'));
  for(const name of examples)fs.copyFileSync(path.join(root,'examples',name),path.join(output,'examples',name));
  fs.mkdirSync(path.join(output,'docs'));
  for(const name of ['README.zh-CN.md','PLUGINS.md','PLUGINS.en.md','canvas.png']){
    fs.copyFileSync(path.join(root,'docs',name),path.join(output,'docs',name));
  }
  fs.copyFileSync(path.join(root,'README.md'),path.join(output,'README.md'));
  fs.copyFileSync(path.join(root,'docs','README.zh-CN.md'),path.join(output,'使用说明.md'));
  fs.writeFileSync(path.join(output,'启动故事树.cmd'),'@echo off\r\nstart "" "%~dp0StoryTree.exe"\r\n');
  fs.writeFileSync(path.join(output,'MCP备用入口.cmd'),
    '@echo off\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"%~dp0StoryTree.exe" "%~dp0resources\\app\\mcp-server.cjs" %*\r\n');
  console.log(output);
}

build().catch(error=>{console.error(error);process.exitCode=1;});
