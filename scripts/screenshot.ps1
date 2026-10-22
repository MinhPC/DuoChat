# Chụp vùng cửa sổ của tiến trình -ProcId ra file PNG (cần cửa sổ đang hiển thị trên màn hình).
param([Parameter(Mandatory)][int]$ProcId, [Parameter(Mandatory)][string]$Out)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Rect {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
"@
Add-Type -AssemblyName System.Drawing

$h = (Get-Process -Id $ProcId).MainWindowHandle
$r = New-Object Win32Rect+RECT
[Win32Rect]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.Right - $r.Left
$ht = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "$w x $ht -> $Out"
