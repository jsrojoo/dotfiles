-----------------------------------------------------------
-- Treesitter configuration file
----------------------------------------------------------

-- Plugin: nvim-treesitter
-- url: https://github.com/nvim-treesitter/nvim-treesitter

local status_ok, nvim_treesitter = pcall(require, "nvim-treesitter")
if not status_ok then
	return
end

local parser_indent_filetypes = {
	"bash",
	"c",
	"cpp",
	"css",
	"html",
	"javascript",
	"json",
	"lua",
	"markdown",
	"query",
	"python",
	"regex",
	"rust",
	"sh",
	"typescript",
	"vim",
	"vimdoc",
	"yaml",
}

nvim_treesitter.setup()

vim.api.nvim_create_autocmd("FileType", {
	pattern = parser_indent_filetypes,
	callback = function()
		vim.bo.indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
	end,
})
