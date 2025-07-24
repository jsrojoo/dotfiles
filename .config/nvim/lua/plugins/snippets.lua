local ls = require("luasnip")
local s = ls.snippet
local sn = ls.snippet_node
local isn = ls.indent_snippet_node
local t = ls.text_node
local i = ls.insert_node

local f = ls.function_node
local c = ls.choice_node
local d = ls.dynamic_node
local r = ls.restore_node
local events = require("luasnip.util.events")
local ai = require("luasnip.nodes.absolute_indexer")
local extras = require("luasnip.extras")
local l = extras.lambda
local rep = extras.rep
local p = extras.partial
local m = extras.match
local n = extras.nonempty
local dl = extras.dynamic_lambda
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local conds = require("luasnip.extras.expand_conditions")
local postfix = require("luasnip.extras.postfix").postfix
local types = require("luasnip.util.types")
local parse = require("luasnip.util.parser").parse_snippet
local ms = ls.multi_snippet
local k = require("luasnip.nodes.key_indexer").new_key


require("luasnip.loaders.from_vscode").lazy_load()

ls.add_snippets('markdown', {
  s("details", {
    t {
      "<details>",
      "  <summary>",
      "  </summary>",
      "</details>",
    },
  })
})

local javascript = require('snippets.javascript')
ls.add_snippets('javascript', javascript)

local python = require('snippets.python')
ls.add_snippets('python', python)

local zsh = require('snippets.zsh')
ls.add_snippets('zsh', zsh)

local sh = require('snippets.sh')
ls.add_snippets('sh', sh)

-- local toml = require('snippets.toml')
-- ls.add_snippets('toml', toml)
