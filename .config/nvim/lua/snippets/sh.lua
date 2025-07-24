local ls = require("luasnip")
local fmt = require("luasnip.extras.fmt").fmt
local i = ls.insert_node

local s = ls.snippet
local t = ls.text_node

local M = {
  s("raycast script", {
    fmt(
      [[
        #!/bin/bash

        # Required parameters:
        # @raycast.schemaVersion 1
        # @raycast.title {}
        # @raycast.mode compact

        # Optional parameters:
        # @raycast.icon
        # @raycast.packageName {}

        # Documentation:
        # @raycast.description {}
        # @raycast.author Joseph Rojo
        ]]
        , {
          i(1, "Name"),
          i(2, "PackageName"),
          i(3, "Description"),
        })
  }),
}

return M
