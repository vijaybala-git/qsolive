; QSOlive Client - Inno Setup script
; Build: Compile this script in Inno Setup after running: pyinstaller --clean QSOlive.spec

#define MyAppName "QSOlive Client"
#define MyAppVersion "1.0"
#define MyAppPublisher "QSOlive"
#define MyAppExeName "QSOlive.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\QSOlive
DefaultGroupName=QSOlive
DisableProgramGroupPage=yes
; Output folder and installer name
OutputDir=installer_output
OutputBaseFilename=QSOlive_Setup_{#MyAppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
; Require admin only if installing for all users (current user is fine)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
; Show next steps on completion
InfoBeforeFile=
InfoAfterFile=NextSteps.txt
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Main executable (build with: pyinstaller --clean QSOlive.spec)
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Config template: install as config.json only if not already present (don't overwrite on upgrade)
Source: "config.example.json"; DestDir: "{app}"; DestName: "config.json"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall
; Next steps doc (shown after install and via Start Menu shortcut)
Source: "NextSteps.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "Run QSOlive client (UDP ADIF to Supabase)"
Name: "{group}\Configure your logger"; Filename: "notepad.exe"; Parameters: """{app}\NextSteps.txt"""; Comment: "How to set up your logging software for UDP"
Name: "{group}\Edit config (advanced)"; Filename: "notepad.exe"; Parameters: """{app}\config.json"""; Comment: "Edit callsign, UDP port, log options"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; Comment: "Run QSOlive client"

[Run]
; Optional: run after install
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
; Show next steps in default text editor after install
Filename: "notepad.exe"; Parameters: """{app}\NextSteps.txt"""; Description: "Open ""Configure your logger"" (next steps)"; Flags: postinstall nowait skipifsilent unchecked

[Code]
var
  CallPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  CallPage := CreateInputQueryPage(wpWelcome,
    'Your callsign',
    'This callsign will appear on the map for contacts you upload.',
    'Callsign (e.g. W6VIJ):');
  CallPage.Add('', False);
  CallPage.Values[0] := '';
end;

function EscapeJsonString(const S: string): string;
var
  i: Integer;
  C: Char;
begin
  Result := '';
  for i := 1 to Length(S) do
  begin
    C := S[i];
    if C = '\' then Result := Result + '\\'
    else if C = '"' then Result := Result + '\"'
    else if (C = #13) or (C = #10) then Result := Result + ' '
    else Result := Result + C;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: string;
  Call: string;
  Json: string;
  JsonAnsi: AnsiString;
begin
  if CurStep = ssPostInstall then
  begin
    ConfigPath := ExpandConstant('{app}\config.json');
    Call := Trim(CallPage.Values[0]);
    if Call = '' then Call := 'YOUR_CALL';
    Call := EscapeJsonString(Call);
    if FileExists(ConfigPath) then
    begin
      if LoadStringFromFile(ConfigPath, JsonAnsi) then        
      begin
        Json := String(JsonAnsi);
        if Pos('YOUR_CALL', Json) > 0 then
        begin
          StringChangeEx(Json, 'YOUR_CALL', Call, False);   
          SaveStringToFile(ConfigPath, AnsiString(Json), False);
        end;
      end;
    end
    else
    begin
      Json := '{' + #13#10 +
        '  "operator_callsign": "' + Call + '",' + #13#10 +
        '  "udp_port": 2237,' + #13#10 +
        '  "udp_host": "0.0.0.0",' + #13#10 +
        '  "update_interval": 1,' + #13#10 +
        '  "retry_attempts": 3,' + #13#10 +
        '  "retry_delay": 5,' + #13#10 +
        '  "log_level": "INFO",' + #13#10 +
        '  "log_file": "qsolive_client.log"' + #13#10 +
        '}';
      SaveStringToFile(ConfigPath, AnsiString(Json), False);
    end;
  end;
end;
