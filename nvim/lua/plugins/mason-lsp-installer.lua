local mason = require("mason")
local mason_lsp_config = require("mason-lspconfig")
local mason_nvim_lint = require("mason-nvim-lint")

local lua_ls = "lua_ls"
local python_linter_formatter = "ruff_lsp"
local python_lsp_completions = "pyright"

local lsps = {
	"bashls",
	"tsserver",
	lua_ls,
	python_linter_formatter,
	python_lsp_completions,
}

mason.setup()

mason_nvim_lint.setup({
	ensure_installed = {
		"eslint_d",
		"luacheck",
		"nix",
		"ruff",
		"shellcheck",
		-- "jsonlint",
		-- "sqlfluff",
		-- "yamllint",
		-- "beautysh",
	},
	automatic_installation = true,
})

mason_lsp_config.setup({
	ensure_installed = lsps,
})

local M = {}

M.python_lsp_completions = python_lsp_completions
M.lsps = lsps
M.lua_ls = lua_ls

return M
