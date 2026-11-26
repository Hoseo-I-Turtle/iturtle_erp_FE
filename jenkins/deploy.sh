#!/usr/bin/env bash
# 젠킨스가 부르는 프론트 배포 스크립트. 볼트에서 접속 값을 읽어 연구실 서버의 ~/workspace/erp-fe/dist 를 그 이미지의 정적 파일로 바꾼다.
# 연구실 nginx(백엔드 저장소 infra/reverse-proxy)가 이 폴더를 lab.iturtle.win 의 / 로 서빙한다 (API 경로는 백엔드로).
#
# 사용: deploy.sh <이미지 태그>
# 필요한 env: VAULT_ADDR · VAULT_TOKEN(젠킨스가 AppRole 로 받은 짧은 토큰) · VAULT_CACERT
#
# 볼트 경로(secret/iturtle_erp/cicd/lab/… — 백엔드와 같은 서버 · 같은 계정):
#   deploy    SSH_HOST · SSH_USER · SSH_PRIVATE_KEY
# 서버 폴더는 백엔드 저장소의 infra/erp-fe/setup.sh 가 만든다 (처음 한 번).
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "사용: deploy.sh <이미지 태그>" >&2
  exit 2
fi
IMAGE_TAG=$1
if [[ ! "$IMAGE_TAG" =~ ^[a-f0-9]{40}$ || ! -f "${LAB_CI_IMAGE_ARCHIVE:-}" || ! -s "$LAB_CI_IMAGE_ARCHIVE" ]]; then
  echo "A valid local frontend image archive is required." >&2
  exit 2
fi

VAULT_CACERT=${VAULT_CACERT:-/etc/ssl/vault/vault.crt}
VAULT_PATH=iturtle_erp/cicd/lab
REMOTE_DIR=/home/iturtle/workspace/erp-fe
KNOWN_HOSTS=${KNOWN_HOSTS:-/home/jenkins/agent/known_hosts}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# 토큰을 명령줄 인자로 넘기면 같은 에이전트의 ps 에 보인다. 헤더 · 인증은 파일 서술자로 넘긴다.
vault_read() {
  local body
  if ! body=$(curl -fsS --cacert "$VAULT_CACERT" \
    -H @<(printf 'X-Vault-Token: %s\n' "$VAULT_TOKEN") \
    "$VAULT_ADDR/v1/secret/data/$VAULT_PATH/$1"); then
    echo "볼트에서 읽지 못했다: secret/$VAULT_PATH/$1" >&2
    return 1
  fi
  jq -e '.data.data' <<<"$body"
}

field() {
  jq -r --arg key "$2" '.[$key] // empty | if test("\n") then . else gsub("^\\s+|\\s+$"; "") end' <<<"$1"
}

echo "배포: erp-fe · $IMAGE_TAG"

deploy_json=$(vault_read deploy)
ssh_host=$(field "$deploy_json" SSH_HOST)
ssh_user=$(field "$deploy_json" SSH_USER)
( umask 077 && field "$deploy_json" SSH_PRIVATE_KEY | tr -d '\r' > "$WORK/key" )
if [[ ! "$ssh_host" =~ ^[A-Za-z0-9.:-]+$ || ! "$ssh_user" =~ ^[A-Za-z0-9._-]+$ || ! -s "$WORK/key" ]]; then
  echo 'Invalid frontend deployment destination' >&2
  exit 2
fi
ssh_opts=(-i "$WORK/key" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$KNOWN_HOSTS")
target="$ssh_user@$ssh_host"
image="local/erp-fe:main-$IMAGE_TAG"
ssh "${ssh_opts[@]}" "$target" docker image load < "$LAB_CI_IMAGE_ARCHIVE"
ssh "${ssh_opts[@]}" "$target" bash -s -- "$REMOTE_DIR" "$image" "$IMAGE_TAG" "$ssh_host" <<'LOCAL_DEPLOY'
set -euo pipefail
cd "$1"
image=$2
revision=$3
host=$4
exec 9>.deployment.lock
flock -x 9
labels=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}} {{index .Config.Labels "org.iturtle.ci.branch"}} {{index .Config.Labels "org.iturtle.ci.service"}}' "$image")
[[ "$labels" == "$revision main erp-fe" ]] || { echo 'Invalid frontend image labels' >&2; exit 1; }

stage=$(mktemp -d .dist-ci.XXXXXXXX)
container=
cleanup() {
  if [ -n "$container" ]; then docker rm "$container" >/dev/null 2>&1 || true; fi
  if [ -n "$stage" ]; then rm -rf -- "$stage"; fi
}
trap cleanup EXIT
container=$(docker create "$image" /none)
docker cp "$container:/dist/." "$stage"
test -s "$stage/index.html"
chmod -R a+rX "$stage"
rm -rf dist.prev
if [ -d dist ]; then mv dist dist.prev; fi
mv "$stage" dist
if ! curl -fsS --retry 3 --resolve "lab.iturtle.win:443:$host" https://lab.iturtle.win/ \
    | cmp -s dist/index.html -; then
  mv dist "$stage"
  if [ -d dist.prev ]; then mv dist.prev dist; fi
  echo 'Frontend health check failed' >&2
  exit 1
fi
stage=
docker rm "$container" >/dev/null
container=
while IFS= read -r reference; do
  if [[ "$reference" == local/erp-fe:main-* && "$reference" != "$image" ]]; then
    docker image rm "$reference" || true
  fi
done < <(docker image ls --filter label=org.iturtle.ci.branch=main \
         --filter label=org.iturtle.ci.service=erp-fe --format '{{.Repository}}:{{.Tag}}')
printf 'Deployment verified: %s\n' "$image"
LOCAL_DEPLOY
