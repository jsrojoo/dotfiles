-- Use a protected call so we don't error out on first use
local status_ok, fzf_lua = pcall(require, "fzf-lua")
if not status_ok then
	return
end

fzf_lua.setup({
	"fzf-vim",
	keymap = {
		fzf = {
			["ctrl-s"] = "toggle-all",
		},
	},
	winopts = {
		backdrop = 100,
	},
	fzf_colors = {
		["fg"] = { "fg", "Normal" },
		["bg"] = { "bg", "Normal" },
		["hl"] = { "fg", "Comment" },
		["fg+"] = { "fg", "Normal" },
		["bg+"] = { "bg", "CursorLine" },
		["hl+"] = { "fg", "Statement" },
		["info"] = { "fg", "PreProc" },
		["prompt"] = { "fg", "Conditional" },
		["pointer"] = { "fg", "Exception" },
		["marker"] = { "fg", "Keyword" },
		["spinner"] = { "fg", "Label" },
		["header"] = { "fg", "Comment" },
		["gutter"] = { "bg", "Normal" },
	},
})

local utils = require("utils")

local nmapleader = utils.nmapleader

nmapleader("ag", ":FzfLua grep_project<cr>")
nmapleader("fg", ":FzfLua files<cr>")
nmapleader("<space>", ":FzfLua buffers<cr>")
nmapleader("fa", ":FzfLua git_files<cr>")
nmapleader("ss", ":FzfLua blines<cr>")
nmapleader("cw", ":FzfLua grep_cword<cr>")
nmapleader("fc", ":FzfLua commands<cr>")
nmapleader("fh", ":FzfLua helptags<cr>")
nmapleader("fk", ":FzfLua keymaps<cr>")
