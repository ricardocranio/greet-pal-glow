@echo off
setlocal enabledelayedexpansion
title Build Instalador NSIS - Monitor de Radios

echo ============================================
echo  Build do INSTALADOR .EXE (NSIS) - Windows
echo ============================================
echo.

REM 1. Verifica Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org/
  pause
  exit /b 1
)

REM 2. Instala dependencias do projeto
echo [1/5] Instalando dependencias do projeto...
call npm install
if errorlevel 1 goto :erro

REM 3. Garante Electron + electron-builder + electron-updater
echo.
echo [2/5] Instalando Electron, electron-builder e electron-updater...
call npm install --save-dev electron electron-builder
if errorlevel 1 goto :erro
call npm install --save electron-updater
if errorlevel 1 goto :erro

REM 4. Build do front-end (Vite)
echo.
echo [3/5] Gerando build de producao (Vite)...
call npx vite build
if errorlevel 1 goto :erro

REM 5. Ajusta package.json via arquivo .js (evita problemas de escape no cmd)
echo.
echo [4/5] Ajustando package.json (main + build config)...
> "%TEMP%\fix-pkg.js" echo const fs=require('fs');
>> "%TEMP%\fix-pkg.js" echo const path=require('path');
>> "%TEMP%\fix-pkg.js" echo const pkgPath=path.resolve('./package.json');
>> "%TEMP%\fix-pkg.js" echo const p=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
>> "%TEMP%\fix-pkg.js" echo p.main='electron/main.cjs';
>> "%TEMP%\fix-pkg.js" echo if(!p.version) p.version='1.0.0';
>> "%TEMP%\fix-pkg.js" echo p.build={
>> "%TEMP%\fix-pkg.js" echo   appId:'com.monitorradios.app',
>> "%TEMP%\fix-pkg.js" echo   productName:'Monitor de Radios',
>> "%TEMP%\fix-pkg.js" echo   copyright:'Monitor de Radios',
>> "%TEMP%\fix-pkg.js" echo   directories:{ output:'electron-release', buildResources:'electron' },
>> "%TEMP%\fix-pkg.js" echo   files:['dist/**/*','electron/**/*','package.json'],
>> "%TEMP%\fix-pkg.js" echo   publish:[{ provider:'github', owner:'ricardocranio', repo:'greet-pal-glow' }],
>> "%TEMP%\fix-pkg.js" echo   win:{
>> "%TEMP%\fix-pkg.js" echo     target:[{ target:'nsis', arch:['x64'] }],
>> "%TEMP%\fix-pkg.js" echo     icon:'electron/icon.ico',
>> "%TEMP%\fix-pkg.js" echo     artifactName:'MonitorRadios-Setup-${version}.${ext}'
>> "%TEMP%\fix-pkg.js" echo   },
>> "%TEMP%\fix-pkg.js" echo   nsis:{
>> "%TEMP%\fix-pkg.js" echo     oneClick:false,
>> "%TEMP%\fix-pkg.js" echo     perMachine:false,
>> "%TEMP%\fix-pkg.js" echo     allowToChangeInstallationDirectory:true,
>> "%TEMP%\fix-pkg.js" echo     createDesktopShortcut:true,
>> "%TEMP%\fix-pkg.js" echo     createStartMenuShortcut:true,
>> "%TEMP%\fix-pkg.js" echo     shortcutName:'Monitor de Radios',
>> "%TEMP%\fix-pkg.js" echo     installerIcon:'electron/icon.ico',
>> "%TEMP%\fix-pkg.js" echo     uninstallerIcon:'electron/icon.ico',
>> "%TEMP%\fix-pkg.js" echo     installerHeaderIcon:'electron/icon.ico',
>> "%TEMP%\fix-pkg.js" echo     deleteAppDataOnUninstall:false,
>> "%TEMP%\fix-pkg.js" echo     runAfterFinish:true
>> "%TEMP%\fix-pkg.js" echo   }
>> "%TEMP%\fix-pkg.js" echo };
>> "%TEMP%\fix-pkg.js" echo fs.writeFileSync(pkgPath,JSON.stringify(p,null,2));
>> "%TEMP%\fix-pkg.js" echo console.log('package.json atualizado para electron-builder + auto-update');

call node "%TEMP%\fix-pkg.js"
if errorlevel 1 goto :erro

REM 6. Build do instalador
echo.
echo [5/5] Gerando instalador NSIS (.exe unico)...
if exist electron-release rmdir /s /q electron-release
call npx electron-builder --win --x64 --publish never
if errorlevel 1 goto :erro

echo.
echo ============================================
echo  INSTALADOR CRIADO COM SUCESSO!
echo ============================================
echo.
echo Arquivo gerado em:
echo   %cd%\electron-release\
echo.
echo Procure por: MonitorRadios-Setup-*.exe
echo.
echo Basta dar duplo clique para instalar.
echo.
pause
exit /b 0

:erro
echo.
echo ============================================
echo  [ERRO] Falha durante o build.
echo ============================================
pause
exit /b 1
