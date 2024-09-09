vim.cmd([[
  function OpenMarkdownPreview (url)
    execute "silent ! open -a /Users/joseph.rojo/Desktop/Arc.app/Contents/MacOS/Arc " . a:url
  endfunction

  let g:mkdp_browserfunc = 'OpenMarkdownPreview'
]])
