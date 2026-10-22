# Gửi phím thật (SendKeys) vào cửa sổ của tiến trình -ProcId, CHỈ KHI cửa sổ đó đang ở foreground.
# Dùng để kiểm thử phím tắt qua before-input-event (CDP Input.dispatchKeyEvent không đi qua đường này).
# Mã thoát: 0 = đã gửi, 2 = không đưa được cửa sổ lên foreground (không gửi gì).
param([Parameter(Mandatory)][int]$ProcId, [Parameter(Mandatory)][string]$Keys)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
}
"@
Add-Type -AssemblyName System.Windows.Forms

$p = Get-Process -Id $ProcId -ErrorAction Stop
$h = $p.MainWindowHandle
[Win32Fg]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
(New-Object -ComObject WScript.Shell).AppActivate($ProcId) | Out-Null
[Win32Fg]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 400

$fgPid = 0
[Win32Fg]::GetWindowThreadProcessId([Win32Fg]::GetForegroundWindow(), [ref]$fgPid) | Out-Null
if ($fgPid -ne $ProcId) { Write-Output "foreground pid=$fgPid, mong đợi $ProcId"; exit 2 }

[System.Windows.Forms.SendKeys]::SendWait($Keys)
exit 0
