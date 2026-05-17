@echo off
title SMSR IoT 4.0 - System Control Panel
color 0F

:menu
cls
echo.
echo    ========================================================
echo    SMSR IoT 4.0 - SYSTEM CONTROL PANEL
echo    ========================================================
echo.
echo    +----------------------------------------------------+
echo    ^|  NOTIFICATION PANEL - SYSTEM STATUS                ^|
echo    +----------------------------------------------------+
echo.
echo    NOTE: Current ESP32 firmware uses MQTT communication.
echo.

:: Enable delayed expansion for variables in loops
setlocal enabledelayedexpansion

:: Check Node.js Server status
wmic process where "name='node.exe' and CommandLine like '%%server.js%%'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
if %ERRORLEVEL%==0 (
    echo    ^|  [32m[*] EXPRESS SERVER[0m      : RUNNING              ^|
    set SERVER_STATUS=1
) else (
    echo    ^|  [31m[X] EXPRESS SERVER[0m      : STOPPED              ^|
    set SERVER_STATUS=0
)

:: Check Node-RED status
wmic process where "name='node.exe' and CommandLine like '%%node-red%%'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
if %ERRORLEVEL%==0 (
    echo    ^|  [32m[*] NODE-RED[0m            : RUNNING              ^|
    set NODERED_STATUS=1
) else (
    echo    ^|  [31m[X] NODE-RED[0m            : STOPPED              ^|
    set NODERED_STATUS=0
)

:: Check MongoDB status
sc query MongoDB 2>NUL | findstr "RUNNING" >NUL
if %ERRORLEVEL%==0 (
    echo    ^|  [32m[*] MONGODB[0m             : RUNNING              ^|
    set MONGO_STATUS=1
) else (
    wmic process where "name='mongod.exe'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
    if !ERRORLEVEL!==0 (
        echo    ^|  [32m[*] MONGODB[0m             : RUNNING              ^|
        set MONGO_STATUS=1
    ) else (
        echo    ^|  [31m[X] MONGODB[0m             : STOPPED              ^|
        set MONGO_STATUS=0
    )
)

:: Check Dashboard accessibility (if server is running)
if %SERVER_STATUS%==1 (
    echo    ^|  [32m[*] DASHBOARD[0m           : ACCESSIBLE            ^|
) else (
    echo    ^|  [31m[X] DASHBOARD[0m           : NOT ACCESSIBLE        ^|
)

echo    +----------------------------------------------------+
echo.
echo    +----------------------------------------------------+
echo    ^|  AVAILABLE ACTIONS                                 ^|
echo    +----------------------------------------------------+
echo    ^|                                                    ^|
echo    ^|  [1] Toggle Express Server                         ^|
echo    ^|  [2] Toggle Node-RED                               ^|
echo    ^|  [3] Toggle MongoDB                                ^|
echo    ^|  [4] Start All Services                            ^|
echo    ^|  [5] Stop All Services                             ^|
echo    ^|  [R] Refresh Status                                ^|
echo    ^|  [X] Exit                                          ^|
echo    ^|                                                    ^|
echo    +----------------------------------------------------+
echo.
choice /c 12345RX /n /m "    Enter your choice: "

if errorlevel 7 goto end
if errorlevel 6 goto menu
if errorlevel 5 goto stop_all
if errorlevel 4 goto start_all
if errorlevel 3 goto toggle_mongo
if errorlevel 2 goto toggle_nodered
if errorlevel 1 goto toggle_server

:toggle_server
cls
echo.
wmic process where "name='node.exe' and CommandLine like '%%server.js%%'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
if %ERRORLEVEL%==0 (
    echo    Stopping Express Server...
    for /f "skip=1 tokens=1" %%p in ('wmic process where "name='node.exe' and CommandLine like '%%server.js%%'" get ProcessId 2^>NUL') do (
        if not "%%p"=="" (
            taskkill /F /PID %%p >NUL 2>&1
        )
    )
    echo    Express Server stopped successfully!
) else (
    netstat -ano | findstr /R /C:":3000 .*LISTENING" >NUL
    if %ERRORLEVEL%==0 (
        echo    Port 3000 is already in use. Skipping server start.
        echo    Check existing process before retrying.
    ) else (
        echo    Starting Express Server...
        start "Express Server - http://localhost:3000" cmd /K "node server.js"
        echo    Express Server started successfully!
    )
)
timeout /t 2 >NUL
goto menu

:toggle_nodered
cls
echo.
wmic process where "name='node.exe' and CommandLine like '%%node-red%%'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
if %ERRORLEVEL%==0 (
    echo    Stopping Node-RED...
    for /f "skip=1 tokens=1" %%p in ('wmic process where "name='node.exe' and CommandLine like '%%node-red%%'" get ProcessId 2^>NUL') do (
        if not "%%p"=="" (
            taskkill /F /PID %%p >NUL 2>&1
        )
    )
    echo    Node-RED stopped successfully!
) else (
    echo    Starting Node-RED...
    start "Node-RED - http://localhost:1880" cmd /K "node-red"
    timeout /t 3 >NUL
    echo    Node-RED started successfully!
)
timeout /t 2 >NUL
goto menu

:toggle_mongo
cls
echo.
sc query MongoDB 2>NUL | findstr "RUNNING" >NUL
if %ERRORLEVEL%==0 (
    echo    Stopping MongoDB service...
    net stop MongoDB >NUL 2>&1
    if %ERRORLEVEL%==0 (
        echo    MongoDB stopped successfully!
    ) else (
        echo    Failed to stop MongoDB. Try running as Administrator.
    )
) else (
    echo    Starting MongoDB service...
    net start MongoDB >NUL 2>&1
    if %ERRORLEVEL%==0 (
        echo    MongoDB started successfully!
    ) else (
        echo    MongoDB service not found. Checking for mongod process...
        wmic process where "name='mongod.exe'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
        if !ERRORLEVEL!==0 (
            echo    Stopping mongod process...
            taskkill /F /IM mongod.exe >NUL 2>&1
            echo    MongoDB stopped!
        ) else (
            echo    MongoDB not found. Please install MongoDB or run as service.
        )
    )
)
timeout /t 2 >NUL
goto menu

:start_all
cls
echo.
echo    ========================================
echo    STARTING ALL SERVICES...
echo    ========================================
echo.

:: Start MongoDB
echo    [1/3] Starting MongoDB...
net start MongoDB >NUL 2>&1
if %ERRORLEVEL%==0 (
    echo          MongoDB started successfully!
) else (
    echo          MongoDB service not available or already running
)
timeout /t 1 >NUL

:: Start Express Server
echo    [2/3] Starting Express Server...
wmic process where "name='node.exe' and CommandLine like '%%server.js%%'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
if %ERRORLEVEL%==0 (
    echo          Express Server already running
) else (
    netstat -ano | findstr /R /C:":3000 .*LISTENING" >NUL
    if %ERRORLEVEL%==0 (
        echo          Port 3000 already in use, skipping Express start
    ) else (
        start "Express Server - http://localhost:3000" cmd /K "node server.js"
        echo          Express Server started successfully!
    )
)
timeout /t 1 >NUL

:: Start Node-RED
echo    [3/3] Starting Node-RED...
wmic process where "name='node.exe' and CommandLine like '%%node-red%%'" get ProcessId 2>NUL | findstr /r "[0-9]" >NUL
if %ERRORLEVEL%==0 (
    echo          Node-RED already running
) else (
    start "Node-RED - http://localhost:1880" cmd /K "node-red"
    echo          Node-RED started successfully!
)

echo.
echo    ========================================
echo    ALL SERVICES STARTED!
echo    ========================================
timeout /t 3 >NUL
goto menu

:stop_all
cls
echo.
echo    ========================================
echo    STOPPING ALL SERVICES...
echo    ========================================
echo.

:: Stop Express Server
echo    [1/3] Stopping Express Server...
for /f "skip=1 tokens=1" %%p in ('wmic process where "name='node.exe' and CommandLine like '%%server.js%%'" get ProcessId 2^>NUL') do (
    if not "%%p"=="" (
        taskkill /F /PID %%p >NUL 2>&1
    )
)
echo          Express Server stopped!
timeout /t 1 >NUL

:: Stop Node-RED
echo    [2/3] Stopping Node-RED...
for /f "skip=1 tokens=1" %%p in ('wmic process where "name='node.exe' and CommandLine like '%%node-red%%'" get ProcessId 2^>NUL') do (
    if not "%%p"=="" (
        taskkill /F /PID %%p >NUL 2>&1
    )
)
echo          Node-RED stopped!
timeout /t 1 >NUL

:: Stop MongoDB
echo    [3/3] Stopping MongoDB...
net stop MongoDB >NUL 2>&1
if %ERRORLEVEL%==0 (
    echo          MongoDB stopped successfully!
) else (
    taskkill /F /IM mongod.exe >NUL 2>&1
    echo          MongoDB stopped!
)

echo.
echo    ========================================
echo    ALL SERVICES STOPPED!
echo    ========================================
timeout /t 3 >NUL
goto menu

:end
cls
echo.
echo    ========================================
echo    SHUTTING DOWN ALL SERVICES...
echo    ========================================
echo.

:: Stop Express Server
echo    [1/2] Stopping Express Server...
for /f "skip=1 tokens=1" %%p in ('wmic process where "name='node.exe' and CommandLine like '%%server.js%%'" get ProcessId 2^>NUL') do (
    if not "%%p"=="" (
        taskkill /F /PID %%p >NUL 2>&1
    )
)

:: Stop Node-RED
echo    [2/2] Stopping Node-RED...
for /f "skip=1 tokens=1" %%p in ('wmic process where "name='node.exe' and CommandLine like '%%node-red%%'" get ProcessId 2^>NUL') do (
    if not "%%p"=="" (
        taskkill /F /PID %%p >NUL 2>&1
    )
)

echo.
echo    Services stopped. Exiting Control Panel...
timeout /t 2 >NUL
exit
