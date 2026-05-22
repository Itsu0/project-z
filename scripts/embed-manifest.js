#!/usr/bin/env node

'use strict'

const { execFileSync } = require('child_process')
const path  = require('path')
const fs    = require('fs')

const exePath = process.argv[2]
if (!exePath || !fs.existsSync(exePath)) {
  console.error('Użycie: node embed-manifest.js <ścieżka/do/electron.exe>')
  process.exit(1)
}

const manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"
          xmlns:asmv3="urn:schemas-microsoft-com:asm.v3">
  <assemblyIdentity version="1.0.0.0" processorArchitecture="AMD64"
                    name="Nexus" type="win32"/>
  <description>Nexus Voice App</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <asmv3:application>
    <asmv3:windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/PM</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </asmv3:windowsSettings>
  </asmv3:application>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>`

const exeAbs = path.resolve(exePath).replace(/'/g, "''")

const ps = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PeRes {
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern IntPtr BeginUpdateResource(string f, bool del);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool UpdateResource(IntPtr h, uint t, uint n, ushort l, byte[] d, uint s);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool EndUpdateResource(IntPtr h, bool discard);
}
'@
$xml   = [System.Text.Encoding]::UTF8.GetBytes([System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes(@'
${manifest.replace(/`/g, '``').replace(/'/g, "''")}
'@)))
$h = [PeRes]::BeginUpdateResource('${exeAbs}', $false)
if ($h -eq 0) { Write-Error "BeginUpdateResource failed: $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"; exit 1 }
$ok = [PeRes]::UpdateResource($h, 24, 1, 1033, $xml, $xml.Length)
if (-not $ok) { [PeRes]::EndUpdateResource($h, $true); Write-Error "UpdateResource failed"; exit 1 }
[PeRes]::EndUpdateResource($h, $false)
Write-Host "OK: manifest osadzony w ${exeAbs}"
`

try {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    stdio: 'inherit',
    timeout: 30000,
  })
  process.exit(0)
} catch (e) {
  console.error('Błąd osadzania manifestu:', e.message)
  process.exit(1)
}
