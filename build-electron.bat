@echo off
setlocal enabledelayedexpansion
title Build Electron - Monitor de Radios

echo ============================================
echo  Build do aplicativo Electron (Windows)
echo ============================================
echo.

REM 1. Verifica se o Node.js esta instalado
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org/ e tente novamente.
  pause
  exit /b 1
)

REM 2. Instala dependencias do projeto
echo [1/4] Instalando dependencias do projeto...
call npm install
if errorlevel 1 goto :erro

REM 3. Garante Electron + Packager como devDependencies
echo.
echo [2/4] Instalando Electron e @electron/packager...
call npm install --save-dev electron @electron/packager
if errorlevel 1 goto :erro

REM 4. Build do front-end (Vite)
echo.
echo [3/4] Gerando build de producao (Vite)...
call npx vite build
if errorlevel 1 goto :erro

REM 5. Garante que package.json tem "main" apontando para electron/main.cjs
echo.
echo [3.5/4] Ajustando package.json (campo "main")...
node -e "const fs=require('fs');const p=require('./package.json');let changed=false;if(p.main!=='electron/main.cjs'){p.main='electron/main.cjs';changed=true;}if(p.type==='module'){/* manter type module: .cjs funciona */}if(changed){fs.writeFileSync('./package.json',JSON.stringify(p,null,2));console.log('package.json atualizado: main=electron/main.cjs');}else{console.log('package.json ja tem main correto');}"
if errorlevel 1 goto :erro

REM 6. Empacota com electron-packager para Windows x64
echo.
echo [4/4] Empacotando aplicativo Electron para Windows x64...
if exist electron-release rmdir /s /q electron-release
call npx @electron/packager . "MonitorRadios" ^
  --platform=win32 --arch=x64 ^
  --out=electron-release --overwrite ^
  --icon=electron/icon.ico ^
  --app-copyright="Monitor de Radios" ^
  --win32metadata.CompanyName="Monitor de Radios" ^
  --win32metadata.ProductName="Monitor de Radios" ^
  --win32metadata.FileDescription="Monitor de Radios - Audiencia em tempo real" ^
  --ignore="^/src" --ignore="^/public" ^
  --ignore="^/electron-release" --ignore="^/supabase" ^
  --ignore="^/playwright.*" --ignore="^/vitest.*" ^
  --ignore="^/mem"
if errorlevel 1 goto :erro

echo.
echo ============================================
echo  BUILD CONCLUIDO COM SUCESSO!
echo ============================================
echo.
echo Aplicativo gerado em:
echo   %cd%\electron-release\MonitorRadios-win32-x64\
echo.
echo Execute: MonitorRadios.exe
echo.
pause
exit /b 0

:erro
echo.
echo ============================================
echo  [ERRO] Falha durante o build. Veja as mensagens acima.
echo ============================================
pause
exit /b 1
