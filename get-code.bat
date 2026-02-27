@echo off
setlocal enabledelayedexpansion

set "outputFile=all_project_code.txt"

:: Delete the output file if it already exists so we start fresh
if exist "%outputFile%" del "%outputFile%"

echo Starting to merge files into %outputFile%...

:: Define the directories you want to copy from (separated by spaces)
set "directories=client\src\pages shared server"

:: Loop through each directory
for %%D in (%directories%) do (
    
    :: Check if the directory actually exists to prevent errors
    if exist "%%D" (
        echo Scanning directory: %%D...
        
        :: Use DIR to find files recursively. It handles variables much better than FOR /R
        for /f "delims=" %%F in ('dir /b /s /a-d "%%D\*.ts" "%%D\*.tsx" 2^>nul') do (
            echo   Adding: %%~nxF
            
            :: Add a divider and the relative file path to the text file
            echo.>> "%outputFile%"
            echo // ========================================================================= >> "%outputFile%"
            echo // FILE: %%F >> "%outputFile%"
            echo // ========================================================================= >> "%outputFile%"
            echo.>> "%outputFile%"
            
            :: Append the actual code of the file
            type "%%F" >> "%outputFile%"
            
            :: Add trailing newlines for readability
            echo.>> "%outputFile%"
            echo.>> "%outputFile%"
        )
    ) else (
        echo Directory not found: %%D
    )
)

echo.
echo ======================================================
echo Done! All code has been combined into %outputFile%
echo ======================================================
pause