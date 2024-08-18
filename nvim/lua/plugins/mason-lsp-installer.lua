-- language server installer
require('paq') {
  "williamboman/mason.nvim",
  "williamboman/mason-lspconfig.nvim",
  "neovim/nvim-lspconfig",
}

local python_linter_formatter = "ruff_lsp"
local python_lsp_completions = "pyright"
local lua_ls = "lua_ls"

local lsps = {
  "bashls",
  lua_ls,
  "ruff",
  "ruff_lsp",
  "tsserver",
  "eslint",
  python_linter_formatter,
  python_lsp_completions,
}

require("mason").setup()
require("mason-lspconfig").setup({
  ensure_installed = lsps,
})

local M = {}

M.python_lsp_completions = python_lsp_completions
M.lsps = lsps
M.lua_ls = lua_ls

return M
