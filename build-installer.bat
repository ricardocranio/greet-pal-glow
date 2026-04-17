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

REM 3. Garante Electron + electron-builder
echo.
echo [2/5] Instalando Electron e electron-builder...
call npm install --save-dev electron electron-builder
if errorlevel 1 goto :erro

REM 4. Build do front-end (Vite)
echo.
echo [3/5] Gerando build de producao (Vite)...
call npx vite build
if errorlevel 1 goto :erro

REM 5. Ajusta package.json: main + metadata para electron-builder
echo.
echo [4/5] Ajustando package.json (main + build config)...
node -e "const fs=require('fs');const p=require('./package.json');p.main='electron/main.cjs';p.build={appId:'com.monitorradios.app',productName:'Monitor de Radios',copyright:'Monitor de Radios',directories:{output:'electron-release',buildResources:'electron'},files:['dist/**/*','electron/**/*','package.json'],win:{target:[{target:'nsis',arch:['x64']}],icon:'electron/icon.ico',artifactName:'MonitorRadios-Setup-${version}.${ext}'},nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'Monitor de Radios',installerIcon:'electron/icon.ico',uninstallerIcon:'electron/icon.ico',installerHeaderIcon:'electron/icon.ico',deleteAppDataOnUninstall:false,runAfterFinish:true}};fs.writeFileSync('./package.json',JSON.stringify(p,null,2));console.log('package.json atualizado para electron-builder');"
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
