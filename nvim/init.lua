require("paq")({
	"savq/paq-nvim",
	"EdenEast/nightfox.nvim",
	"L3MON4D3/LuaSnip",
	"Vimjas/vim-python-pep8-indent",
	"hrsh7th/cmp-buffer",
	"hrsh7th/cmp-cmdline",
	"hrsh7th/cmp-nvim-lsp",
	"hrsh7th/cmp-path",
	"hrsh7th/nvim-cmp",
	"ibhagwan/fzf-lua",
	"lewis6991/gitsigns.nvim",
	"lukas-reineke/indent-blankline.nvim",
	"maxmx03/solarized.nvim",
	"mfussenegger/nvim-lint",
	"rshkarin/mason-nvim-lint",
	"neovim/nvim-lspconfig",
	"nmac427/guess-indent.nvim",
	"nvim-lua/plenary.nvim",
	"nvimtools/none-ls-extras.nvim",
	"nvimtools/none-ls.nvim",
	"pmizio/typescript-tools.nvim",
	"projekt0n/github-nvim-theme",
	"saadparwaiz1/cmp_luasnip",
	"spywhere/tmux.nvim",
	"tpope/vim-fugitive",
	"williamboman/mason-lspconfig.nvim",
	"williamboman/mason.nvim",
	{ "mhartington/formatter.nvim" },
	{ "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" },
	{ "stevearc/conform.nvim" },
})

require("options")
require("keymaps")

require("plugins/completions")
require("plugins/formatter")
require("plugins/fuzzy-finder")
require("plugins/git")
require("plugins/linters")
require("plugins/lsp-config")
require("plugins/mason-lsp-installer")
require("plugins/python")
require("plugins/reactjs")
require("plugins/treesitter")

vim.cmd.colorscheme("github_light_default")

require("guess-indent").setup({})
require("ibl").setup({})
