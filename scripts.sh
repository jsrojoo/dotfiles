decodeJWT() {
    if [[ -x $(command -v jq) ]]; then
         jq -R 'split(".") | .[0],.[1] | @base64d | fromjson' <<< "${1}"
         echo "Signature: $(echo "${1}" | awk -F'.' '{print $3}')"
    fi
}

function slugify() {
    echo "$1" \
    | iconv -t ascii//TRANSLIT \
    | sed -r 's/[~\^]+//g' \
    | sed -r 's/[^a-zA-Z0-9]+/-/g' \
    | sed -r 's/^-+\|-+$//g' \
    | tr A-Z a-z
}

