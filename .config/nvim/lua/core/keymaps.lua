-----------------------------------------------------------
-- Define keymaps of Neovim and installed plugins.
-----------------------------------------------------------
local function map(mode, lhs, rhs, opts)
	local options = { noremap = true, silent = true }
	if opts then
		options = vim.tbl_extend("force", options, opts)
	end
	vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

local function modemap(mode, lhs, rhs, opts)
	return map(mode, lhs, rhs, opts)
end

local function nmap(lhs, rhs, opts)
	return modemap("n", lhs, rhs, opts)
end

local function tmap(lhs, rhs, opts)
	return modemap("t", lhs, rhs, opts)
end

local function tmapleader(lsh, rhs, opts)
	return tmap("<space>" .. lsh, rhs, opts)
end

local function nmapleader(lsh, rhs, opts)
	return nmap("<leader>" .. lsh, rhs, opts)
end
-----------------------------------------------------------
-- Neovim shortcuts
-----------------------------------------------------------

-- Disable arrow keys
map("", "<up>", "<nop>")
map("", "<down>", "<nop>")
map("", "<left>", "<nop>")
map("", "<right>", "<nop>")

-- Map space to leader key
map("", "<space>", "<leader>", { noremap = false })

-- Convenience keymaps
nmapleader("w", ":w!<cr>")
nmapleader("q", ":q!<cr>")
nmapleader("ei", ":e $MYVIMRC<cr>")
nmapleader("eo", ":e ~/dotfiles/.config/nvim/lua/core/options.lua<cr>")
nmapleader("ek", ":e ~/dotfiles/.config/nvim/lua/core/keymaps.lua<cr>")

nmapleader("fs", ":set foldmethod=expr<CR>")
nmapleader("fi", ":set foldmethod=indent<CR>")

tmapleader("<esc>", "<C-\\><C-n>")

nmap(";", ":")
nmap("<C-h>", "<C-w>h")
nmap("<C-j>", "<C-w>j")
nmap("<C-k>", "<C-w>k")
nmap("<C-l>", "<C-w>l")

nmap("<leader>z", ":Z ")

nmap("<C-w>v", "<C-w>v<C-w><C-w>")
nmap("<C-w>s", "<C-w>s<C-w><C-w>")

-- Remap increment
nmap("<C-s>", "<C-a>")

-----------------------------------------------------------
-- Plugin shortcuts
-----------------------------------------------------------
-- FZF

nmapleader("ag", ":FzfLua grep_project<cr>")
nmapleader("fa", ":FzfLua files<cr>")
nmapleader("<space>", ":FzfLua buffers<cr>")
nmapleader("fg", ":FzfLua git_files<cr>")
nmapleader("ss", ":FzfLua blines<cr>")
nmapleader("cw", ":FzfLua grep_cword<cr>")
nmapleader("fc", ":FzfLua commands<cr>")
nmapleader("fk", ":FzfLua keymaps<cr>")
nmapleader("fh", ":FzfLua helptags<cr>")

nmapleader("fo", ":Oil<cr>")

nmapleader("gs", ":G <cr>")

-- Smalls
map("n", "s", "<Plug>(smalls)", { noremap = false })
map("o", "s", "<Plug>(smalls)", { noremap = false })
map("x", "s", "<Plug>(smalls)", { noremap = false })

nmap("]d", "<cmd>lua vim.diagnostic.goto_prev()<cr>")
nmap("[d", "<cmd>lua vim.diagnostic.goto_next()<cr>")

nmapleader("dl", "<cmd>lua vim.diagnostic.setloclist()<cr>")

-- vim.cmd([[
--
-- function! NavigateObsidianDailyNotes(day)
--   let l:offset = 0
--   let l:day = a:day
--
--   function! _NavigateObsidianDailyNotes()
--     if l:day == "today"
--       l:offset = 0
--     elseif l:day == "yesterday"
--       l:offset -= 1
--     endif
--
--     return ':ObsidianToday ' ..  l:offset
--   endfunction
--
--   return funcref("_NavigateObsidianDailyNotes")
-- endfunction
--
-- ]])

nmapleader("ot", ":ObsidianToday<cr>")
nmapleader("op", ":ObsidianYesterday<cr>")
nmapleader("on", ":ObsidianTomorrow<cr>")
nmapleader("ofa", ":ObsidianQuickSwitch<cr>")

nmapleader("mp", ":RenderMarkdown toggle<cr>")
