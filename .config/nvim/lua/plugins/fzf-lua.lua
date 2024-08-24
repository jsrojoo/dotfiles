-- Use a protected call so we don't error out on first use
local status_ok, fzf_lua = pcall(require, 'fzf-lua')
if not status_ok then
  return
end

fzf_lua.setup {
  'fzf-vim',
  winopts = {
    backdrop = 100,
  },
  fzf_colors = true;
}
