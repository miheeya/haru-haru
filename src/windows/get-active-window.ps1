Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$h = [WinAPI]::GetForegroundWindow()
$sb = New-Object Text.StringBuilder 512
[void][WinAPI]::GetWindowText($h, $sb, 512)
$pid2 = 0
[void][WinAPI]::GetWindowThreadProcessId($h, [ref]$pid2)
$proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
$pName = if ($proc) { $proc.ProcessName } else { "unknown" }
$wTitle = $sb.ToString()

# Output as Base64-encoded UTF-8 JSON to avoid console codepage corruption
$json = @{ processName = $pName; windowTitle = $wTitle } | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
[System.Convert]::ToBase64String($bytes)
