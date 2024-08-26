-----------------------------------------------------------
-- Neovim LSP configuration file
-----------------------------------------------------------
local lsp_status_ok, lspconfig = pcall(require, "lspconfig")

if not lsp_status_ok then
	return
end

local cmp_status_ok, cmp_nvim_lsp = pcall(require, "cmp_nvim_lsp")

if not cmp_status_ok then
	return
end

local null_ls_ok, null_ls = pcall(require, "null-ls")

if not null_ls_ok then
	return
end

local mason_ok, mason = pcall(require, "mason")

if not mason_ok then
	return
end

local mason_lspconfig_ok, mason_lspconfig = pcall(require, "mason-lspconfig")

if not mason_lspconfig_ok then
	return
end

local capabilities = vim.lsp.protocol.make_client_capabilities()

capabilities = cmp_nvim_lsp.default_capabilities(capabilities)

local on_attach = function(client, bufnr)
	if client.server_capabilities.documentHighlightProvider then
		vim.api.nvim_create_augroup("lsp_document_highlight", { clear = true })
		vim.api.nvim_clear_autocmds({ buffer = bufnr, group = "lsp_document_highlight" })
		vim.api.nvim_create_autocmd("CursorHold", {
			callback = vim.lsp.buf.document_highlight,
			buffer = bufnr,
			group = "lsp_document_highlight",
			desc = "Document Highlight",
		})
		vim.api.nvim_create_autocmd("CursorMoved", {
			callback = vim.lsp.buf.clear_references,
			buffer = bufnr,
			group = "lsp_document_highlight",
			desc = "Clear All the References",
		})
	end

	local bufopts = { noremap = true, silent = true, buffer = bufnr }

	vim.keymap.set("n", "gD", vim.lsp.buf.declaration, bufopts)
	vim.keymap.set("n", "gd", vim.lsp.buf.definition, bufopts)
	vim.keymap.set("n", "K", vim.lsp.buf.hover, bufopts)
	vim.keymap.set("n", "gi", vim.lsp.buf.implementation, bufopts)
	vim.keymap.set("n", "<C-k>", vim.lsp.buf.signature_help, bufopts)
	vim.keymap.set("n", "<leader>wa", vim.lsp.buf.add_workspace_folder, bufopts)
	vim.keymap.set("n", "<leader>wr", vim.lsp.buf.remove_workspace_folder, bufopts)
	vim.keymap.set("n", "<leader>wl", function()
		print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
	end, bufopts)
	vim.keymap.set("n", "<leader>D", vim.lsp.buf.type_definition, bufopts)
	vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, bufopts)
	vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, bufopts)
	vim.keymap.set("n", "gr", vim.lsp.buf.references, bufopts)
	vim.keymap.set("n", "<leader>fe", function()
		vim.lsp.buf.format({ async = true })
	end, bufopts)
end

vim.diagnostic.config({
	virtual_text = false,
	update_in_insert = true,
	current_line_virtual_text = true,
	float = {
		focusable = false,
		style = "minimal",
		border = "rounded",
		source = "always",
		header = "",
		prefix = "",
	},
})

local root_dir = function()
	return vim.fn.getcwd()
end

local servers = {
	"bashls",
	"cssls",
	"html",
	"pyright",
	"ruff_lsp",
	"tsserver",
	"yamlls",
	"lua_ls",
	"quick_lint_js",
	"ruff",
	"vimls",
}

mason.setup()
mason_lspconfig.setup()

for _, lsp in ipairs(servers) do
	lspconfig[lsp].setup({
		on_attach = on_attach,
		root_dir = root_dir,
		capabilities = capabilities,
	})
end

lspconfig.eslint.setup({
	root_dir = root_dir,
	capabilities = capabilities,
	on_attach = function(client, bufnr)
		on_attach(client, bufnr)
		vim.api.nvim_create_autocmd("BufWritePre", {
			buffer = bufnr,
			command = "EslintFixAll",
		})
	end,
})

lspconfig.lua_ls.setup({
	settings = {
		Lua = {
			runtime = {
				version = "LuaJIT",
			},
			diagnostics = {
				globals = {
					"vim",
					"require",
				},
			},
			workspace = {
				-- Make the server aware of Neovim runtime files
				library = vim.api.nvim_get_runtime_file("", true),
			},
			-- Do not send telemetry data containing a randomized but unique identifier
			telemetry = {
				enable = false,
			},
		},
	},
})

null_ls.setup({
	on_attach = on_attach,
	sources = {
		null_ls.builtins.code_actions.refactoring,
		null_ls.builtins.diagnostics.trail_space,
		null_ls.builtins.diagnostics.dotenv_linter,
		null_ls.builtins.diagnostics.markdownlint,
		null_ls.builtins.diagnostics.sqlfluff.with({ extra_args = { "--dialect", "postgres" } }),
		null_ls.builtins.diagnostics.statix,
		null_ls.builtins.diagnostics.vint,
		null_ls.builtins.diagnostics.zsh,
		null_ls.builtins.formatting.alejandra,
		null_ls.builtins.formatting.stylua,
	},
})
