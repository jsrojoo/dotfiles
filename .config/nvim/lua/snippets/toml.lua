local ls = require("luasnip")

local i = ls.insert_node
local s = ls.snippet
local t = ls.text_node
local f = ls.function_node
local fmt = require("luasnip.extras.fmt").fmt

local mise_python = [[
[tools]
python = "3.13"

[tasks]
g = [
  './g.sh'
]

[env]
_.python.venv = { path = ".venv", create = true, python = "3.13" }
REPO = "<>"
repo = "repo"
]]

-- local lines = {}
--
-- for _str in str:gmatch("[^\r\n]+") do
--   table.insert(lines, t(_str))
--   table.insert(lines, t(' '))
-- end

local M = {
  s("pymise", {
    fmt(mise_python,
      {
        i(1, "repo")
      },
      {
        delimiters = "<>"
      })
  })
}

return M
