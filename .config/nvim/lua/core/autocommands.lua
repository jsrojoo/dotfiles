vim.cmd([[
autocmd CmdwinEnter * map <buffer> <CR> <CR>q:
]])

local wrap_sync_group = vim.api.nvim_create_augroup("wrap_sync_opts", { clear = true })

local function sync_wrap_deps()
  -- Use current local value of 'wrap' to drive the others
  local wrap_on = vim.opt_local.wrap:get()
  if wrap_on then
    -- When wrap is on, force soft-wrapping UX: word-boundary linebreak and hide list chars
    vim.opt_local.linebreak = true
    vim.opt_local.list = false
  else
    -- When wrap is off, revert to the window's defaults by inheriting the global values
    -- This avoids us forcing a choice and respects your baseline config
    vim.cmd("setlocal linebreak< list<")
  end
end

vim.api.nvim_create_autocmd("OptionSet", {
  group = wrap_sync_group,
  pattern = "wrap",
  desc = "Sync linebreak and list with wrap",
  callback = sync_wrap_deps,
})

-- Also apply once when entering a window so defaults stay consistent
vim.api.nvim_create_autocmd({ "BufWinEnter", "WinNew" }, {
  group = wrap_sync_group,
  desc = "Ensure linebreak/list align with wrap on window enter",
  callback = sync_wrap_deps,
})
