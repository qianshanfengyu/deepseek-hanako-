' start-pet.vbs - silently launch deepseek pet (no console window)
' Called by desktop deepseek pet .lnk via wscript.exe.
' Single instance: if already running, new instance exits on port conflict.
' NOTE: keep comments ASCII-only. Non-ASCII comments in a No-BOM file get
' misparsed by the VBScript engine under the ANSI (GBK) codepage, which can
' swallow the newline and pull the next code line into a comment.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run """E:\AI\dsh-jiadaizi-like-pet\electron\node_modules\electron\dist\electron.exe"" ""E:\AI\dsh-jiadaizi-like-pet\electron""", 1, False
Set sh = Nothing
