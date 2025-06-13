-----------------------------------------------------------
-- Autocomplete configuration file
-----------------------------------------------------------

-- Plugin: nvim-cmp
-- url: https://github.com/hrsh7th/nvim-cmp

local cmp_status_ok, cmp = pcall(require, "cmp")

if not cmp_status_ok then
  return
end

local luasnip_status_ok, luasnip = pcall(require, "luasnip")

if not luasnip_status_ok then
  return
end

cmp.setup({
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },
  completion = {
    -- autocomplete = true,
    completeopt = 'menu,menuone',
  },
  window = {
    completion = cmp.config.window.bordered(),
    documentation = cmp.config.window.bordered(),
  },
  mapping = {
    ["<C-n>"] = cmp.mapping.select_next_item(),
    ["<C-p>"] = cmp.mapping.select_prev_item(),
    ["<C-u>"] = cmp.mapping.scroll_docs(-4),
    ["<C-d>"] = cmp.mapping.scroll_docs(4),
    ["<C-space>"] = cmp.mapping.complete(),
    ["<C-e>"] = cmp.mapping.abort(),
    ["<Tab>"] = cmp.mapping.confirm({ select = true }),
  },
  sources = {
    { name = "luasnip", priority = 1000 },
    { name = "nvim_lsp", priority = 500 },
    { name = "copilot" },
    { name = "path" },
    { name = "buffer" },
  },
})

vim.cmd([[
autocmd FileType sql,mysql,plsql lua require('cmp').setup.buffer({ sources = {{ name = 'vim-dadbod-completion' }} })
" autocmd FileType lua lua require('cmp').setup.buffer({ sources = {{ name = 'nvim_lua' }} })
]])
