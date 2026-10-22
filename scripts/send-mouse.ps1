# Gửi chuột thật vào cửa sổ của tiến trình -ProcId, CHỈ KHI cửa sổ đó đang ở foreground.
# Toạ độ X,Y tính theo DIP trong vùng client của cửa sổ (giống toạ độ trong shell), -Dpr là tỉ lệ DPI của màn hình.
# Action: click | rightclick | drag (kéo từ X,Y tới X2,Y2).
# Mã thoát: 0 = đã gửi, 2 = cửa sổ không ở foreground (không gửi gì).
param(
  [Parameter(Mandatory)][int]$ProcId,
  [Parameter(Mandatory)][ValidateSet('click', 'rightclick', 'drag')][string]$Action,
  [Parameter(Mandatory)][double]$X,
  [Parameter(Mandatory)][double]$Y,
  [double]$X2 = 0,
  [double]$Y2 = 0,
  [double]$Dpr = 1
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Mouse {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
}
"@

[Win32Mouse]::SetProcessDPIAware() | Out-Null
$p = Get-Process -Id $ProcId -ErrorAction Stop
$h = $p.MainWindowHandle
[Win32Mouse]::ShowWindow($h, 9) | Out-Null
(New-Object -ComObject WScript.Shell).AppActivate($ProcId) | Out-Null
[Win32Mouse]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 400

$fgPid = 0
[Win32Mouse]::GetWindowThreadProcessId([Win32Mouse]::GetForegroundWindow(), [ref]$fgPid) | Out-Null
if ($fgPid -ne $ProcId) { Write-Output "foreground pid=$fgPid, mong đợi $ProcId"; exit 2 }

$origin = New-Object Win32Mouse+POINT
[Win32Mouse]::ClientToScreen($h, [ref]$origin) | Out-Null
function ToScreen([double]$cx, [double]$cy) {
  return @([int]($origin.X + $cx * $Dpr), [int]($origin.Y + $cy * $Dpr))
}

$LDOWN = 0x2; $LUP = 0x4; $RDOWN = 0x8; $RUP = 0x10
$a = ToScreen $X $Y
[Win32Mouse]::SetCursorPos($a[0], $a[1]) | Out-Null
Start-Sleep -Milliseconds 120

switch ($Action) {
  'click' {
    [Win32Mouse]::mouse_event($LDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 60
    [Win32Mouse]::mouse_event($LUP, 0, 0, 0, [UIntPtr]::Zero)
  }
  'rightclick' {
    [Win32Mouse]::mouse_event($RDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 60
    [Win32Mouse]::mouse_event($RUP, 0, 0, 0, [UIntPtr]::Zero)
  }
  'drag' {
    $b = ToScreen $X2 $Y2
    [Win32Mouse]::mouse_event($LDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 250
    $steps = 12
    for ($i = 1; $i -le $steps; $i++) {
      $nx = [int]($a[0] + ($b[0] - $a[0]) * $i / $steps)
      $ny = [int]($a[1] + ($b[1] - $a[1]) * $i / $steps)
      [Win32Mouse]::SetCursorPos($nx, $ny) | Out-Null
      Start-Sleep -Milliseconds 40
    }
    Start-Sleep -Milliseconds 150
    [Win32Mouse]::mouse_event($LUP, 0, 0, 0, [UIntPtr]::Zero)
  }
}
exit 0
