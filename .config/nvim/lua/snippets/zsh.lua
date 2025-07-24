local ls = require("luasnip")

local s = ls.snippet
local t = ls.text_node

local M = {
  s("rebase", {
    t({
      "git pull origin --rebase --autostash develop"
    })
  }),
  s("tmux sql", {
    t({
      "tmux new-window -n pgcli; tmux new-window -n psql;"
    })
  }),
  s("tmux server", {
    t({
      "tmux new-window -n server;"
    })
  }),
}

return M
