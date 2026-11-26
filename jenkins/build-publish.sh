#!/usr/bin/env bash
set -euo pipefail

: "${GIT_COMMIT:?Jenkins checkout required}"
[[ $GIT_COMMIT =~ ^[0-9a-f]{40}$ ]] || exit 2
image="ghcr.io/hoseo-i-turtle/iturtle_erp_fe:$GIT_COMMIT"
vault_cacert=${VAULT_CACERT:-/etc/ssl/vault/vault.crt}
known_hosts="$(dirname -- "${BASH_SOURCE[0]}")/build-known-hosts"
local_tmp=$(mktemp -d)
remote_tmp=''
cleanup() {
    if [[ -n $remote_tmp ]]; then
        ssh "${ssh_opts[@]}" "$target" "rm -rf -- '$remote_tmp'" || true
    fi
    rm -rf -- "$local_tmp"
}
trap cleanup EXIT

vault_read() {
    curl -fsS --cacert "$vault_cacert" \
        -H @<(printf 'X-Vault-Token: %s\n' "$VAULT_TOKEN") \
        "$VAULT_ADDR/v1/secret/data/$1" | jq -e '.data.data'
}

deploy=$(vault_read iturtle_erp/cicd/lab/deploy)
target="$(jq -er '.SSH_USER | select(length > 0)' <<<"$deploy")@$(jq -er '.SSH_HOST | select(length > 0)' <<<"$deploy")"
(umask 077; jq -er '.SSH_PRIVATE_KEY | select(length > 0)' <<<"$deploy" | tr -d '\r' >"$local_tmp/key")
unset deploy
ssh_opts=(-i "$local_tmp/key" -o BatchMode=yes -o IdentitiesOnly=yes
    -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o "UserKnownHostsFile=$known_hosts")

# Check the Vault policy before spending time on a build. Keep the credential out of the build container.
publish=$(vault_read iturtle_erp/cicd/lab/registry-publish)
publish_user=$(jq -er '.jenkins_GHCR_publish_user // "jbkim4040"' <<<"$publish")
[[ $publish_user =~ ^[A-Za-z0-9-]+$ ]] || exit 2
publish_token=$(jq -er '.jenkins_GHCR_publish_token | select(type == "string" and length > 0)' <<<"$publish")
unset publish

remote_tmp=$(ssh "${ssh_opts[@]}" "$target" 'mktemp -d /tmp/erp-fe-ci.XXXXXXXX')
if ! [[ $remote_tmp =~ ^/tmp/erp-fe-ci\.[A-Za-z0-9]+$ ]]; then
    remote_tmp=''
    exit 2
fi
git archive --format=tar "$GIT_COMMIT" |
    ssh "${ssh_opts[@]}" "$target" "cat > '$remote_tmp/source.tar'"

ssh "${ssh_opts[@]}" "$target" bash -s -- "$remote_tmp" "$image" "$GIT_COMMIT" <<'BUILD'
set -euo pipefail
work=$1
image=$2
revision=$3
mkdir "$work/output"
chmod 644 "$work/source.tar"

docker run --rm --cap-drop=ALL --security-opt=no-new-privileges \
    --cpus=2 --memory=4g --pids-limit=256 --user "$(id -u):$(id -g)" \
    --mount "type=bind,src=$work/source.tar,dst=/source.tar,readonly" \
    --mount "type=bind,src=$work/output,dst=/output" \
    node:24-bookworm-slim sh -ec '
        mkdir /tmp/app
        cd /tmp/app
        tar -xf /source.tar
        npm ci --no-audit --no-fund --cache /tmp/npm
        npm run lint
        npm run build
        test -s dist/index.html
        mv dist /output/dist
    '


printf 'FROM scratch\nCOPY dist /dist\n' | docker build --network=none -f - \
    --label org.opencontainers.image.source=https://github.com/Hoseo-I-Turtle/iturtle_erp_FE \
    --label "org.opencontainers.image.revision=$revision" \
    -t "$image" "$work/output"
BUILD

printf '%s\n' "$publish_token" |
    ssh "${ssh_opts[@]}" "$target" "set -eu; export DOCKER_CONFIG='$remote_tmp/docker'; mkdir -m 700 \"\$DOCKER_CONFIG\"; docker login ghcr.io -u '$publish_user' --password-stdin >/dev/null; docker push '$image'"
