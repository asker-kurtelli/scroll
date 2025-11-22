@echo off
REM Build script for Scroll extension
REM Use this script to prepare the extension for different browsers

set TARGET=%1

if "%TARGET%"=="chrome" (
    echo Preparing extension for Chrome...
    if exist "manifest.backup.json" (
        del manifest.json
        ren manifest.backup.json manifest.json
        echo Restored original manifest.json for Chrome
    ) else (
        echo Original manifest.json already in place for Chrome
    )
    goto :end
)

if "%TARGET%"=="firefox" (
    echo Preparing extension for Firefox...
    if not exist "manifest.backup.json" (
        copy manifest.json manifest.backup.json
        echo Backed up original manifest.json
    )
    copy manifest.firefox.json manifest.json
    echo Updated manifest.json for Firefox compatibility
    goto :end
)

echo Usage: %0 [chrome^|firefox]
echo   chrome  - Prepare extension for Chrome (default)
echo   firefox - Prepare extension for Firefox
goto :end

:end
echo Build complete for %TARGET%!
pause