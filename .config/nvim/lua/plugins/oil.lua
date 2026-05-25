local ok, oil = pcall(require, "oil")

if not ok then
  return
end

local syntax_group = vim.api.nvim_create_augroup("OilSyntax", { clear = true })

vim.api.nvim_create_autocmd("FileType", {
  group = syntax_group,
  pattern = "oil",
  callback = function(event)
    vim.api.nvim_buf_call(event.buf, function()
      vim.cmd("runtime! syntax/oil.vim")
    end)
  end,
})

oil.setup({
  skip_confirm_for_simple_edits = true,
  view_options = {
    show_hidden = true,
  },
})
