# Jenkins builds /dist before assembling the deploy image.
# 서버에서 실행하지 않는다 — 젠킨스 배포(jenkins/deploy.sh)가 이미지에서 /dist 를 꺼내 연구실 nginx 가 서빙하는 폴더에 놓는다.
FROM scratch
COPY dist /dist
