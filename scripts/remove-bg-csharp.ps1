$csharpCode = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class BgRemover
{
    public static void Process(string srcPath, string outPath, string[] targetDirs)
    {
        using (Bitmap srcBmp = (Bitmap)Image.FromFile(srcPath))
        {
            int w = srcBmp.Width;
            int h = srcBmp.Height;

            Bitmap transparentBmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);

            BitmapData srcData = srcBmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            BitmapData dstData = transparentBmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

            int stride = Math.Abs(srcData.Stride);
            int bytes = stride * h;
            byte[] srcBytes = new byte[bytes];
            byte[] dstBytes = new byte[bytes];

            System.Runtime.InteropServices.Marshal.Copy(srcData.Scan0, srcBytes, 0, bytes);

            // BFS from all 4 borders
            byte[] visited = new byte[w * h]; // 0: unvisited, 1: background, 2: shield edge
            Queue<int> queue = new Queue<int>();

            float lowLum = 25.0f;
            float highLum = 70.0f;

            // Enqueue all boundary pixels
            for (int x = 0; x < w; x++)
            {
                queue.Enqueue((0 << 16) | x);
                visited[0 * w + x] = 1;
                queue.Enqueue(((h - 1) << 16) | x);
                visited[(h - 1) * w + x] = 1;
            }
            for (int y = 1; y < h - 1; y++)
            {
                queue.Enqueue((y << 16) | 0);
                visited[y * w + 0] = 1;
                queue.Enqueue((y << 16) | (w - 1));
                visited[y * w + (w - 1)] = 1;
            }

            int[] dx = { -1, 1, 0, 0 };
            int[] dy = { 0, 0, -1, 1 };

            while (queue.Count > 0)
            {
                int val = queue.Dequeue();
                int cx = val & 0xFFFF;
                int cy = (val >> 16) & 0xFFFF;

                for (int i = 0; i < 4; i++)
                {
                    int nx = cx + dx[i];
                    int ny = cy + dy[i];

                    if (nx >= 0 && nx < w && ny >= 0 && ny < h)
                    {
                        int pos = ny * w + nx;
                        if (visited[pos] == 0)
                        {
                            int idx = (ny * stride) + (nx * 4);
                            byte b = srcBytes[idx];
                            byte g = srcBytes[idx + 1];
                            byte r = srcBytes[idx + 2];
                            float lum = 0.299f * r + 0.587f * g + 0.114f * b;

                            if (lum < highLum)
                            {
                                visited[pos] = 1;
                                queue.Enqueue((ny << 16) | nx);
                            }
                            else
                            {
                                visited[pos] = 2; // Shield boundary
                            }
                        }
                    }
                }
            }

            // Write output pixels
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int idx = (y * stride) + (x * 4);
                    byte b = srcBytes[idx];
                    byte g = srcBytes[idx + 1];
                    byte r = srcBytes[idx + 2];
                    int pos = y * w + x;

                    if (visited[pos] == 1)
                    {
                        float lum = 0.299f * r + 0.587f * g + 0.114f * b;
                        if (lum <= lowLum)
                        {
                            dstBytes[idx] = 0;
                            dstBytes[idx + 1] = 0;
                            dstBytes[idx + 2] = 0;
                            dstBytes[idx + 3] = 0;
                        }
                        else
                        {
                            float t = (lum - lowLum) / (highLum - lowLum);
                            if (t > 1.0f) t = 1.0f;
                            if (t < 0.0f) t = 0.0f;
                            byte alpha = (byte)(255 * t);

                            // Background color compensation (neutralize dark halo)
                            float bgR = 8.0f, bgG = 2.0f, bgB = 32.0f;
                            int unR = (int)Math.Min(255, Math.Max(0, (r - bgR * (1.0f - t)) / Math.Max(0.01f, t)));
                            int unG = (int)Math.Min(255, Math.Max(0, (g - bgG * (1.0f - t)) / Math.Max(0.01f, t)));
                            int unB = (int)Math.Min(255, Math.Max(0, (b - bgB * (1.0f - t)) / Math.Max(0.01f, t)));

                            dstBytes[idx] = (byte)unB;
                            dstBytes[idx + 1] = (byte)unG;
                            dstBytes[idx + 2] = (byte)unR;
                            dstBytes[idx + 3] = alpha;
                        }
                    }
                    else
                    {
                        // Shield interior / edge: 100% solid
                        dstBytes[idx] = b;
                        dstBytes[idx + 1] = g;
                        dstBytes[idx + 2] = r;
                        dstBytes[idx + 3] = 255;
                    }
                }
            }

            System.Runtime.InteropServices.Marshal.Copy(dstBytes, 0, dstData.Scan0, bytes);
            srcBmp.UnlockBits(srcData);
            transparentBmp.UnlockBits(dstData);

            // Save full-res transparent PNG
            transparentBmp.Save(outPath, ImageFormat.Png);
            Console.WriteLine("Saved master transparent icon: " + outPath);

            // Generate icons for 16, 32, 48, 128
            int[] sizes = { 16, 32, 48, 128 };
            foreach (string dir in targetDirs)
            {
                if (!System.IO.Directory.Exists(dir))
                {
                    System.IO.Directory.CreateDirectory(dir);
                }
                foreach (int s in sizes)
                {
                    using (Bitmap scaled = new Bitmap(s, s, PixelFormat.Format32bppArgb))
                    {
                        using (Graphics g = Graphics.FromImage(scaled))
                        {
                            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            g.SmoothingMode = SmoothingMode.HighQuality;
                            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            g.CompositingQuality = CompositingQuality.HighQuality;
                            g.DrawImage(transparentBmp, 0, 0, s, s);
                        }
                        string outFile = System.IO.Path.Combine(dir, "icon-" + s + ".png");
                        scaled.Save(outFile, ImageFormat.Png);
                        Console.WriteLine("Generated: " + outFile);
                    }
                }
            }

            transparentBmp.Dispose();
        }
    }
}
"@

Add-Type -TypeDefinition $csharpCode -ReferencedAssemblies System.Drawing

$src = "C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_1789250052316.jpg"
$outMaster = "C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_transparent.png"
$dirs = @(
    "c:\Users\KHUZAIMA\Desktop\personal\extension-qa\public\icons",
    "c:\Users\KHUZAIMA\Desktop\personal\extension-qa\dist\icons"
)

[BgRemover]::Process($src, $outMaster, $dirs)
Write-Host "All transparent icons created successfully!"
