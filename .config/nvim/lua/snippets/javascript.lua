local ls = require("luasnip")

local s = ls.snippet
local t = ls.text_node

local M = {
  s(";index", {
    t({
      "?."
    })
  }),
  s(";idx", {
    t({
      "?."
    })
  }),
  s(";op", {
    t({
      "?."
    })
  }),
  s("and", {
    t({
      "&& "
    })
  }),
  s("or", {
    t({
      "|| "
    })
  }),
  s("not", {
    t({
      "!"
    })
  }),
  s("elif", {
    t({
      "else if "
    })
  })
}

return M
