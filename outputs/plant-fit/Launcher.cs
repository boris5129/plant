using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;

internal static class Launcher
{
    private static readonly int Port = ReadPort();
    private static readonly string Address = "http://127.0.0.1:" + Port + "/";
    private static readonly Dictionary<string, string[]> Files = new Dictionary<string, string[]>
    {
        { "/", new[] { "index.html", "text/html; charset=utf-8" } },
        { "/app.js", new[] { "app.js", "text/javascript; charset=utf-8" } },
        { "/catalog.js", new[] { "catalog.js", "text/javascript; charset=utf-8" } },
        { "/workbook.js", new[] { "workbook.js", "text/javascript; charset=utf-8" } },
        { "/photos.js", new[] { "photos.js", "text/javascript; charset=utf-8" } },
        { "/growth.js", new[] { "growth.js", "text/javascript; charset=utf-8" } },
        { "/care.js", new[] { "care.js", "text/javascript; charset=utf-8" } },
        { "/jszip.min.js", new[] { "jszip.min.js", "text/javascript; charset=utf-8" } },
        { "/JSZip-LICENSE.markdown", new[] { "JSZip-LICENSE.markdown", "text/plain; charset=utf-8" } },
        { "/original-data.js", new[] { "original-data.js", "text/javascript; charset=utf-8" } },
        { "/style.css", new[] { "style.css", "text/css; charset=utf-8" } },
        { "/plant-fit-template.xlsx", new[] { "plant-fit-template.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }
    };

    private static int ReadPort()
    {
        int port;
        return int.TryParse(Environment.GetEnvironmentVariable("PLANT_FIT_PORT"), out port)
            && port > 0 && port <= 65535 ? port : 4187;
    }

    private static int Main(string[] args)
    {
        Console.Title = "PLANT FIT";
        Console.OutputEncoding = Encoding.UTF8;
        bool openBrowser = Array.IndexOf(args, "--no-open") < 0;
        var server = new TcpListener(IPAddress.Loopback, Port);
        try
        {
            server.Server.ExclusiveAddressUse = true;
            server.Start(32);
        }
        catch (SocketException)
        {
            if (IsPlantFitRunning())
            {
                if (openBrowser) OpenBrowser();
                return 0;
            }
            Console.WriteLine("로컬 포트 " + Port + "이 사용 중입니다. 해당 프로그램을 닫고 다시 실행하세요.");
            if (openBrowser) Console.ReadLine();
            return 1;
        }

        using (var clientSlots = new Semaphore(16, 16))
        {
            Console.WriteLine("PLANT FIT  " + Address);
            Console.WriteLine("이 창을 닫으면 로컬 서버가 종료됩니다.");
            if (openBrowser) OpenBrowser();
            while (true)
            {
                clientSlots.WaitOne();
                TcpClient client = server.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(_ =>
                {
                    try { Serve(client); }
                    catch (IOException) { }
                    catch (SocketException) { }
                    finally { clientSlots.Release(); }
                });
            }
        }
    }

    private static bool IsPlantFitRunning()
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(Address);
            request.Method = "HEAD";
            request.Proxy = null;
            request.Timeout = 1500;
            using (var response = (HttpWebResponse)request.GetResponse())
                return response.Headers["X-Plant-Fit"] == "local";
        }
        catch (WebException) { return false; }
    }

    private static void OpenBrowser()
    {
        try { Process.Start(new ProcessStartInfo(Address) { UseShellExecute = true }); }
        catch (System.ComponentModel.Win32Exception)
        {
            Console.WriteLine("기본 브라우저를 열지 못했습니다. 주소를 직접 여세요.");
        }
    }

    private static void Serve(TcpClient client)
    {
        using (client)
        {
            client.ReceiveTimeout = 3000;
            client.SendTimeout = 3000;
            using (NetworkStream stream = client.GetStream())
            {
                string request = ReadRequest(stream);
                string[] lines = request.Split(new[] { "\r\n" }, StringSplitOptions.None);
                string[] parts = lines[0].Split(' ');
                if (parts.Length != 3 || !Array.Exists(lines, IsLocalHost))
                {
                    Reply(stream, "400 Bad Request", "text/plain", null, false);
                    return;
                }
                bool head = parts[0] == "HEAD";
                if (!head && parts[0] != "GET")
                {
                    Reply(stream, "405 Method Not Allowed", "text/plain", null, false);
                    return;
                }
                string[] file;
                if (!Files.TryGetValue(parts[1].Split('?')[0], out file))
                {
                    Reply(stream, "404 Not Found", "text/plain", null, head);
                    return;
                }
                using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(file[0]))
                    Reply(stream, "200 OK", file[1], resource, head);
            }
        }
    }

    private static bool IsLocalHost(string line)
    {
        return line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)
            && line.Substring(5).Trim() == "127.0.0.1:" + Port;
    }

    private static string ReadRequest(Stream stream)
    {
        var header = new StringBuilder();
        while (header.Length < 8192)
        {
            int next = stream.ReadByte();
            if (next < 0) return "";
            header.Append((char)next);
            int n = header.Length;
            if (n >= 4 && header[n - 4] == '\r' && header[n - 3] == '\n'
                && header[n - 2] == '\r' && header[n - 1] == '\n') return header.ToString();
        }
        return "";
    }

    private static void Reply(Stream stream, string status, string type, Stream resource, bool head)
    {
        string headers = "HTTP/1.1 " + status + "\r\nContent-Type: " + type
            + "\r\nContent-Length: " + (resource == null ? 0 : resource.Length)
            + "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Plant-Fit: local\r\nX-Content-Type-Options: nosniff\r\n\r\n";
        byte[] encoded = Encoding.ASCII.GetBytes(headers);
        stream.Write(encoded, 0, encoded.Length);
        if (!head && resource != null) resource.CopyTo(stream);
    }
}
