vim.loader.enable()

require("core/options")
require("core/keymaps")

require("packer_init")

require("plugins/nvim-cmp")
require("lsp/lspconfig")
require("plugins/fzf-lua")
require("plugins/indent-blankline")
require("plugins/smalls")
require("plugins/quick-scope")
require("plugins/gitsigns")
require("plugins/luasnip")
require("plugins/firenvim")
require("plugins/nvim-treesitter")
-- require("plugins/oil")

-- require('plugins/obsidian')

-- plugins
require("nvim_comment").setup()
require("swagger-preview").setup({})

require("local-highlight").setup({
	file_types = { "python", "cpp", "lua" },
	disable_file_types = { "tex" },
	hlgroup = "Search",
	cw_hlgroup = nil,
	insert_mode = false,
	min_match_len = 1,
	max_match_len = math.huge,
	highlight_single_match = true,
})

local plugins = {
	"coverage",
	"no-neck-pain",
	"hlslens",
	"react-extract",
}

for _, plugin in ipairs(plugins) do
	local status_ok, plug = pcall(require, plugin)

	plug.setup({})
end

vim.api.nvim_create_user_command("RefactorReact", function(opts)
	local react_extract_ok, react_extract = pcall(require, "react-extract")
	react_extract.extract_to_current_file()
end, {})

require("tint").setup({
	tint = -20,
	saturation = 0.3,
})

vim.cmd([[
" colorscheme rose-pine
colorscheme catppuccin-latte

let g:fugitive_gitlab_domains = ['https://gitlab.scm-emea.aws.fisv.cloud']
]])
