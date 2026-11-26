// Main deploys use the image built and tested on the lab CI engine.
// Leave IMAGE_TAG blank to use the latest successfully deployed local image.

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
        string(name: 'IMAGE_TAG', defaultValue: '', description: 'Blank selects the latest deployed local image. A full SHA must match the retained image.')
    }

    stages {
        stage('Manual') {
            when {
                beforeAgent true
                triggeredBy 'UserIdCause'
            }
            steps {
                script {
                    deployStoredFrontend(params.IMAGE_TAG?.trim() ?: '')
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
                    deployLocalFrontend()
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

def deployLocalFrontend() {
    if (env.BRANCH_NAME != 'main') {
        error('Local frontend CI deployment is available on main only')
    }
    withEnv(["LAB_CI_IMAGE_ARCHIVE=.lab-ci/erp-fe-${env.GIT_COMMIT}.tar"]) {
        try {
            sh 'bash /run/lab-ci-artifacts/build-local.sh erp-fe "$LAB_CI_IMAGE_ARCHIVE"'
            deploy(env.GIT_COMMIT)
            sh 'bash /run/lab-ci-artifacts/local-images.sh retain erp-fe "$GIT_COMMIT" "$LAB_CI_IMAGE_ARCHIVE"'
        } finally {
            sh 'rm -f -- "$LAB_CI_IMAGE_ARCHIVE"'
        }
    }
}

def deployStoredFrontend(String requested) {
    withEnv(["LAB_CI_IMAGE_REQUEST=${requested}"]) {
        def archive = sh(returnStdout: true, script: 'bash /run/lab-ci-artifacts/local-images.sh resolve erp-fe "${LAB_CI_IMAGE_REQUEST:-}"').trim()
        withEnv(["LAB_CI_IMAGE_ARCHIVE=${archive}"]) {
            deploy(archive.tokenize('/').last().take(40))
        }
    }
}

def deploy(String tag) {
    currentBuild.description = "erp-fe · ${tag.take(12)}"
    withEnv(["DEPLOY_TAG=${tag}"]) {
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
