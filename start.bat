@echo off
echo Flex time running at http://localhost:8765
start http://localhost:8765
python -m http.server 8765
