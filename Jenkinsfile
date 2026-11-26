// Build on the lab CI engine, then deploy its local image.
// GitHub 푸시 이벤트로 실행하며 기존 pollSCM도 유지한다.
// 문서만 바뀐 경우 자동 배포를 생략한다.
// 되돌릴 때는 손으로 돌린다 (IMAGE_TAG 에 커밋 SHA 또는 main).

pipeline {
    agent { label 'lab-build' }

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
                allOf {
                    branch 'main'
                    not { triggeredBy 'UserIdCause' }
                }
            }
            steps {
                script {
                    if (onlyDocsChanged()) {
                        echo '문서만 바뀌어 배포하지 않는다'
                        return
                    }
                    withEnv(["LAB_CI_IMAGE_ARCHIVE=.lab-ci/erp-fe-${env.GIT_COMMIT}.tar"]) {
                        try {
                            sh 'bash /run/lab-ci-artifacts/build-local.sh erp-fe "$LAB_CI_IMAGE_ARCHIVE"'
                            deploy(env.GIT_COMMIT, 0)
                        } finally {
                            sh 'rm -f -- "$LAB_CI_IMAGE_ARCHIVE"'
                        }
                    }
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
    return !paths.isEmpty() && paths.every { it.startsWith('docs/') || it.endsWith('.md') }
}

def deploy(String tag, int waitSeconds) {
    currentBuild.description = "erp-fe · ${tag.take(12)}"
    withEnv(["DEPLOY_TAG=${tag}", "WAIT_FOR_IMAGE=${waitSeconds}"]) {
        withCiVault {
            sh 'bash jenkins/deploy.sh "$DEPLOY_TAG"'
        }
    }
}

def withCiVault(Closure body) {
    withCredentials([[
        $class: 'VaultTokenCredentialBinding',
        credentialsId: 'jenkins-cicd-approle',
        vaultAddr: 'https://vault:8200',
    ]]) {
        body()
    }
}
