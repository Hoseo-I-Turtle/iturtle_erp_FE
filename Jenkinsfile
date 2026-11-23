// 프론트 배포 파이프라인. 빌드 · 이미지 푸시는 GitHub Actions 가 한다 — 볼트가 떠 있는 이 호스트에서 npm 패키지 코드를 돌리지 않는다.
// 젠킨스가 사설망(WARP) 안에 있어 GitHub webhook 을 받을 수 없으므로 2분마다 main 을 확인한다(pollSCM).
// main 에 새 커밋이 오면 그 커밋 이미지가 GHCR 에 올라올 때까지 기다렸다가 연구실 서버(~/workspace/erp-fe/dist)에 놓는다. 문서만 바뀌면 배포하지 않는다.
// 되돌릴 때는 손으로 돌린다 (IMAGE_TAG 에 커밋 SHA 또는 main).

pipeline {
    agent { label 'builder-1' }

    triggers {
        pollSCM('H/2 * * * *')
    }

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '50'))
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        string(name: 'IMAGE_TAG', defaultValue: '', description: '손으로 돌릴 때만 쓴다. 비우면 main(최신). 되돌릴 때는 커밋 SHA')
    }

    stages {
        stage('Manual') {
            when {
                beforeAgent true
                triggeredBy 'UserIdCause'
            }
            steps {
                script {
                    deploy(params.IMAGE_TAG?.trim() ?: 'main', 0)
                }
            }
        }

        stage('Auto') {
            when {
                beforeAgent true
                not { triggeredBy 'UserIdCause' }
            }
            steps {
                script {
                    if (onlyDocsChanged()) {
                        echo '문서만 바뀌어 배포하지 않는다'
                        return
                    }
                    deploy(env.GIT_COMMIT, 900)
                }
            }
        }
    }
}

@NonCPS
def onlyDocsChanged() {
    def paths = []
    for (changeSet in currentBuild.changeSets) {
        for (entry in changeSet.items) {
            paths.addAll(entry.affectedPaths)
        }
    }
    return !paths.isEmpty() && paths.every { it.startsWith('docs/') || it.endsWith('.md') || it.startsWith('jenkins/') || it == 'Jenkinsfile' }
}

def deploy(String tag, int waitSeconds) {
    currentBuild.description = "erp-fe · ${tag.take(12)}"
    withEnv(["DEPLOY_TAG=${tag}", "WAIT_FOR_IMAGE=${waitSeconds}"]) {
        withCredentials([[
            $class: 'VaultTokenCredentialBinding',
            credentialsId: 'jenkins-cicd-approle',
            vaultAddr: 'https://vault:8200',
        ]]) {
            sh 'bash jenkins/deploy.sh "$DEPLOY_TAG"'
        }
    }
}
