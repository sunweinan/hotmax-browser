#!/bin/zsh
# 启动本目录的独立浏览器工程；无入参；退出码为 npm 的执行结果。
cd "$(dirname "$0")" || exit 1
exec npm start
