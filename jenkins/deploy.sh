#!/usr/bin/env bash
# 젠킨스가 부르는 프론트 배포 스크립트. 볼트에서 접속 값을 읽어 연구실 서버의 ~/workspace/erp-fe/dist 를 그 이미지의 정적 파일로 바꾼다.
# 연구실 nginx(백엔드 저장소 infra/reverse-proxy)가 이 폴더를 lab.iturtle.win 의 / 로 서빙한다 (API 경로는 백엔드로).
#
# 사용: deploy.sh <이미지 태그>
# 필요한 env: VAULT_ADDR · VAULT_TOKEN(젠킨스가 AppRole 로 받은 짧은 토큰) · VAULT_CACERT
#            WAIT_FOR_IMAGE — 이미지가 GHCR 에 올라올 때까지 기다릴 초(자동 배포는 Actions 빌드를 기다린다, 손 배포는 0)
#
# 볼트 경로(secret/iturtle_erp/cicd/lab/… — 백엔드와 같은 서버 · 같은 계정):
#   deploy    SSH_HOST · SSH_USER · SSH_PRIVATE_KEY
#   registry  GHCR_USER · GHCR_TOKEN (read:packages)
# 서버 폴더는 백엔드 저장소의 infra/erp-fe/setup.sh 가 만든다 (처음 한 번).
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "사용: deploy.sh <이미지 태그>" >&2
  exit 2
fi
IMAGE_TAG=$1
if ! [[ "$IMAGE_TAG" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "허용하지 않는 글자가 있다: $IMAGE_TAG" >&2
  exit 2
fi

VAULT_CACERT=${VAULT_CACERT:-/etc/ssl/vault/vault.crt}
VAULT_PATH=iturtle_erp/cicd/lab
IMAGE_PATH=hoseo-i-turtle/iturtle_erp_fe
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

ghcr_token() {
  curl -fsS --netrc-file <(printf 'machine ghcr.io login %s password %s\n' "$GHCR_USER" "$GHCR_TOKEN") \
    "https://ghcr.io/token?service=ghcr.io&scope=repository:$IMAGE_PATH:pull" | jq -er '.token'
}

image_exists() {
  local token
  token=$(ghcr_token)
  curl -fsS -o /dev/null -I \
    -H @<(printf 'Authorization: Bearer %s\nAccept: %s\n' "$token" \
      'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json') \
    "https://ghcr.io/v2/$IMAGE_PATH/manifests/$IMAGE_TAG"
}

echo "배포: erp-fe · $IMAGE_TAG"

deploy_json=$(vault_read deploy)
ssh_host=$(field "$deploy_json" SSH_HOST)
ssh_user=$(field "$deploy_json" SSH_USER)
( umask 077 && field "$deploy_json" SSH_PRIVATE_KEY | tr -d '\r' > "$WORK/key" )
if [[ -n "${LAB_CI_IMAGE_ARCHIVE:-}" ]]; then
  if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ || ! -s "$LAB_CI_IMAGE_ARCHIVE" ||
        ! "$ssh_host" =~ ^[A-Za-z0-9.:-]+$ || ! "$ssh_user" =~ ^[A-Za-z0-9._-]+$ ||
        ! -s "$WORK/key" ]]; then
    echo 'Invalid frontend CI artifact or deployment destination' >&2
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
  exit 0
fi
registry_json=$(vault_read registry)
GHCR_USER=$(field "$registry_json" GHCR_USER)
GHCR_TOKEN=$(field "$registry_json" GHCR_TOKEN)
if [ -z "$ssh_host" ] || [ -z "$ssh_user" ] || [ ! -s "$WORK/key" ] || [ -z "$GHCR_USER" ] || [ -z "$GHCR_TOKEN" ]; then
  echo "볼트 $VAULT_PATH/deploy · registry 값이 모자란다" >&2
  exit 1
fi

deadline=$((SECONDS + ${WAIT_FOR_IMAGE:-0}))
until image_exists; do
  if (( SECONDS >= deadline )); then
    echo "이미지가 없다: ghcr.io/$IMAGE_PATH:$IMAGE_TAG" >&2
    exit 1
  fi
  echo "이미지를 기다린다: ghcr.io/$IMAGE_PATH:$IMAGE_TAG"
  sleep 20
done

ssh_opts=(-i "$WORK/key" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$KNOWN_HOSTS")
target="$ssh_user@$ssh_host"

printf '%s' "$GHCR_TOKEN" | ssh "${ssh_opts[@]}" "$target" "docker login ghcr.io -u $(printf '%q' "$GHCR_USER") --password-stdin" >/dev/null

# 이미지에서 /dist 를 꺼내 dist.next 로 놓고 dist 와 바꿔 끼운다. nginx 는 폴더(erp-fe)를 마운트하므로 바꾼 dist 를 바로 본다.
# 옛 것은 dist.prev 에 하나 남긴다 (되돌리기: mv dist dist.bad && mv dist.prev dist).
ssh "${ssh_opts[@]}" "$target" bash -s -- "$REMOTE_DIR" "ghcr.io/$IMAGE_PATH:$IMAGE_TAG" <<'REMOTE'
set -euo pipefail
cd "$1"
image=$2
status=0
docker pull -q "$image" >/dev/null || status=$?
docker logout ghcr.io >/dev/null 2>&1 || true
[ "$status" -eq 0 ] || exit "$status"

container=$(docker create "$image" /none)
rm -rf dist.next
docker cp "$container:/dist" dist.next
docker rm "$container" >/dev/null
docker rmi "$image" >/dev/null 2>&1 || true

if [ ! -s dist.next/index.html ]; then
  echo "이미지에 index.html 이 없다" >&2
  rm -rf dist.next
  exit 1
fi
chmod -R a+rX dist.next
rm -rf dist.prev
[ -d dist ] && mv dist dist.prev
mv dist.next dist
echo "dist: $(find dist -type f | wc -l) 개 파일"
REMOTE

# nginx 가 새 파일을 내주는지 확인한다 (서버 안에서 lab.iturtle.win 으로 — nginx 는 서버 사설 IP 의 443 에만 붙어 있다)
ssh "${ssh_opts[@]}" "$target" "curl -fsS -o /dev/null --resolve lab.iturtle.win:443:$ssh_host https://lab.iturtle.win/ && echo '응답 확인: https://lab.iturtle.win/'" \

echo "배포 끝: ghcr.io/$IMAGE_PATH:$IMAGE_TAG"
