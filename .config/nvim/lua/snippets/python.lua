local ls = require("luasnip")

local i = ls.insert_node
local s = ls.snippet
local t = ls.text_node
local f = ls.function_node

local M = {
  s("pr", {
    t("print('"),
    f(function(args)
      return args[1][1]
    end, { 1 }),
    t("', "),
    i(1, "var"),
    t(")")
  })
}

return M
