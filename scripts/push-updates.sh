cd ~/Documents/work-notes/

git add .
git_files="$(git --no-pager diff --staged --name-only | sed 's/^/- /')"

echo "backup $(date)"
echo "test $git_files"
git commit -m "backup $(date)" -m "$git_files"
# git push origin

