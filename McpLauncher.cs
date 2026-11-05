using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Text;
class StoryTreeMcp {
  static string Q(string s) { return "\"" + s.Replace("\"", "\\\"") + "\""; }
  static int Main(string[] args) {
    try {
      var utf8=new UTF8Encoding(false);
      Console.InputEncoding=utf8;Console.OutputEncoding=utf8;
      bool debug=Environment.GetEnvironmentVariable("STORYTREE_MCP_DEBUG")=="1";
      if(debug)Console.Error.WriteLine("MCP launcher starting");
      var root=AppDomain.CurrentDomain.BaseDirectory;
      var psi=new ProcessStartInfo(Path.Combine(root,"StoryTree.exe"));
      psi.UseShellExecute=false;psi.CreateNoWindow=true;psi.WorkingDirectory=root;
      psi.RedirectStandardInput=true;psi.RedirectStandardOutput=true;psi.RedirectStandardError=true;
      psi.StandardOutputEncoding=utf8;psi.StandardErrorEncoding=utf8;
      psi.EnvironmentVariables["ELECTRON_RUN_AS_NODE"]="1";
      psi.EnvironmentVariables.Remove("NODE_OPTIONS");
      psi.Arguments=Q(Path.Combine(root,"resources","app","mcp-server.cjs"));
      foreach(var a in args)psi.Arguments+=" "+Q(a);
      if(debug)Console.Error.WriteLine("MCP runtime: "+psi.FileName+" "+psi.Arguments);
      using(var child=Process.Start(psi)) {
        if(debug)Console.Error.WriteLine("MCP runtime PID: "+child.Id);
        Task.Factory.StartNew(()=>{try {string line;while((line=Console.ReadLine())!=null){var bytes=utf8.GetBytes(line+"\n");child.StandardInput.BaseStream.Write(bytes,0,bytes.Length);child.StandardInput.BaseStream.Flush();if(debug)Console.Error.WriteLine("MCP request forwarded");}child.StandardInput.Close();} catch(Exception err){if(debug)Console.Error.WriteLine(err.Message);}});
        var output=Task.Factory.StartNew(()=>{string line;while((line=child.StandardOutput.ReadLine())!=null){Console.WriteLine(line);Console.Out.Flush();}});
        var errors=Task.Factory.StartNew(()=>{string line;while((line=child.StandardError.ReadLine())!=null){Console.Error.WriteLine(line);Console.Error.Flush();}});
        child.WaitForExit();Task.WaitAll(output,errors);return child.ExitCode;
      }
    } catch(Exception e) {Console.Error.WriteLine(e.Message);return 1;}
  }
}
