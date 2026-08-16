' start-pet.vbs - silently launch whale pet (no console window, recommended)
' Uses relative path from this script's folder so the package is portable.
' NOTE: keep comments ASCII-only.
Option Explicit
Dim sh, fso, baseDir, appDir, exe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = baseDir & "\electron"
exe = appDir & "\node_modules\electron\dist\electron.exe"
If fso.FileExists(exe) Then
  sh.Run """" & exe & """ """ & appDir & """", 1, False
End If
Set sh = Nothing
Set fso = Nothing
