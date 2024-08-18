require("nvim-treesitter.configs").setup({
	-- A list of parser names, or "all" (the listed parsers MUST always be installed)
	ensure_installed = {
		"lua",
		"vim",
		"vimdoc",
		"query",
		"markdown",
		"markdown_inline",
    "python",
    "typescript",
	},

	-- Install parsers synchronously (only applied to `ensure_installed`)
	sync_install = false,

	-- Automatically install missing parsers when entering buffer
	-- Recommendation: set to false if you don't have `tree-sitter` CLI installed locally
	auto_install = true,

	-- List of parsers to ignore installing (or "all")
	ignore_install = { "javascript" },

	---- If you need to change the installation directory of the parsers (see -> Advanced Setup)
	-- parser_install_dir = "/some/path/to/store/parsers", -- Remember to run vim.opt.runtimepath:append("/some/path/to/store/parsers")!

	highlight = {
		enable = true,

		-- NOTE: these are the names of the parsers and not the filetype. (for example if you want to
		-- disable highlighting for the `tex` filetype, you need to include `latex` in this list as this is
		-- the name of the parser)
		-- list of language that will be disabled
		-- Or use a function for more flexibility, e.g. to disable slow treesitter highlight for large files
		disable = function(lang, buf)
			local max_filesize = 100 * 1024 -- 100 KB
			local ok, stats = pcall(vim.loop.fs_stat, vim.api.nvim_buf_get_name(buf))
			if ok and stats and stats.size > max_filesize then
				return true
			end
		end,

		-- Setting this to true will run `:h syntax` and tree-sitter at the same time.
		-- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
		-- Using this option may slow down your editor, and you may see some duplicate highlights.
		-- Instead of true it can also be a list of languages
		additional_vim_regex_highlighting = false,
	},
	indent = {
		enable = true,
		disable = {},
	},
	pairs = {
		enable = true,
		disable = {},
		highlight_pair_events = {}, -- e.g. {"CursorMoved"}, -- when to highlight the pairs, use {} to deactivate highlighting
		highlight_self = false, -- whether to highlight also the part of the pair under cursor (or only the partner)
		goto_right_end = false, -- whether to go to the end of the right partner or the beginning
		fallback_cmd_normal = "call matchit#Match_wrapper('',1,'n')", -- What command to issue when we can't find a pair (e.g. "normal!
		keymaps = {
			goto_partner = "<leader>%",
			delete_balanced = "X",
		},
		delete_balanced = {
			only_on_first_char = false, -- whether to trigger balanced delete when on first character of a pair
			fallback_cmd_normal = nil, -- fallback command when no pair found, can be nil
			longest_partner = false, -- whether to delete the longest or the shortest pair when multiple found.
			-- E.g. whether to delete the angle bracket or whole tag in  <pair> </pair>
		},
	},
	matchup = {
		enable = true, -- mandatory, false will disable the whole extension
		disable = { "c", "ruby" }, -- optional, list of language that will be disabled
		-- [options]
	},
})
