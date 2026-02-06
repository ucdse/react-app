pipeline {
    agent {
        kubernetes {
            cloud 'kubernetes'
            defaultContainer 'node'
            yaml '''
apiVersion: v1
kind: Pod
metadata:
  labels:
    jenkins/label: react-app-build
spec:
  containers:
    - name: node
      image: node:24-slim
      command:
        - sleep
      args:
        - "9999999"
      tty: true
      workingDir: /home/jenkins/agent
      volumeMounts:
        - mountPath: /home/jenkins/.npm
          name: npm-cache
    - name: docker
      image: docker:27-cli
      command:
        - sleep
      args:
        - "9999999"
      tty: true
      workingDir: /home/jenkins/agent
      volumeMounts:
        - mountPath: /var/run/docker.sock
          name: docker-sock
  volumes:
    - name: npm-cache
      emptyDir: {}
    - name: docker-sock
      hostPath:
        path: /var/run/docker.sock
'''
        }
    }

    parameters {
        string(name: 'IMAGE_NAME', defaultValue: 'kaiwenyao/react-app', description: 'Docker image name')
        string(name: 'IMAGE_TAG', defaultValue: '', description: 'Image tag (empty means BUILD_NUMBER)')
        booleanParam(name: 'PUSH_IMAGE', defaultValue: true, description: 'Push image to registry')
        booleanParam(name: 'DEPLOY_TO_EC2', defaultValue: false, description: 'Deploy container to EC2')
        string(name: 'CONTAINER_NAME', defaultValue: 'react-app', description: 'Container name on EC2')
        string(name: 'CONTAINER_ENV_FILE', defaultValue: '/opt/react-app/.env', description: 'Env file path on EC2')
        string(name: 'BACKEND_HOST', defaultValue: 'flask-app', description: 'Backend container DNS name in Docker network')
        string(name: 'BACKEND_PORT', defaultValue: '5000', description: 'Backend container port')
        string(name: 'EC2_SSH_KEY_CREDENTIALS_ID', defaultValue: 'server-ssh-key', description: 'Jenkins SSH key credential ID')
    }

    environment {
        DOCKER_CREDENTIALS_ID = 'docker-hub-credentials'
        SERVER_HOST_CREDENTIALS_ID = 'aws-ec2'
        ENV_FILE_CREDENTIALS_ID = 'react-prod.env'
    }

    stages {
        stage('1. 拉取代码') {
            steps {
                checkout scm
            }
        }

        stage('2. TypeScript 和 ESLint 检查') {
            steps {
                container('node') {
                    sh '''
                    node --version
                    npm --version
                    npm ci
                    npm run lint
                    npx tsc --noEmit
                    '''
                }
            }
        }

        stage('3. 构建并推送 Docker 镜像') {
            when {
                not { changeRequest() }
            }
            steps {
                container('docker') {
                    script {
                        def finalTag = params.IMAGE_TAG?.trim() ? params.IMAGE_TAG.trim() : env.BUILD_NUMBER
                        env.FULL_IMAGE = "${params.IMAGE_NAME}:${finalTag}"
                    }

                    withCredentials([
                        usernamePassword(
                            credentialsId: env.DOCKER_CREDENTIALS_ID,
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh '''
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                        docker build -t ${FULL_IMAGE} .
                        if [ "${PUSH_IMAGE}" = "true" ] || [ "${DEPLOY_TO_EC2}" = "true" ]; then
                          docker push ${FULL_IMAGE}
                        fi
                        docker logout || true
                        '''
                    }
                }
            }
        }

        stage('4. 部署到 EC2') {
            when {
                allOf {
                    branch 'main'
                    not { changeRequest() }
                }
            }
            environment {
                CONTAINER_ENV_FILE = "${params.CONTAINER_ENV_FILE}"
            }
            steps {
                container('docker') {
                    withCredentials([
                        string(credentialsId: env.SERVER_HOST_CREDENTIALS_ID, variable: 'SERVER_HOST'),
                        sshUserPrivateKey(credentialsId: params.EC2_SSH_KEY_CREDENTIALS_ID, keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
                        usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS'),
                        file(credentialsId: env.ENV_FILE_CREDENTIALS_ID, variable: 'ENV_FILE')
                    ]) {
                        sh '''
                        if command -v apk >/dev/null 2>&1; then
                          apk add --no-cache openssh-client bash
                        fi

                        # 在 EC2 上创建 .env 所在目录（若不存在）
                        ENV_DIR=$(dirname "${CONTAINER_ENV_FILE}")
                        ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER_HOST}" "mkdir -p ${ENV_DIR}"

                        # 将 Jenkins 中的 .env credential 上传到 EC2 指定路径
                        scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${ENV_FILE}" "${SSH_USER}@${SERVER_HOST}:${CONTAINER_ENV_FILE}"

                        PASS_B64=$(printf '%s' "${DOCKER_PASS}" | base64)
                        USER_B64=$(printf '%s' "${DOCKER_USER}" | base64)
                        IMAGE_B64=$(printf '%s' "${FULL_IMAGE}" | base64)
                        NAME_B64=$(printf '%s' "${CONTAINER_NAME}" | base64)
                        ENV_FILE_B64=$(printf '%s' "${CONTAINER_ENV_FILE}" | base64)
                        BACKEND_HOST_B64=$(printf '%s' "${BACKEND_HOST}" | base64)
                        BACKEND_PORT_B64=$(printf '%s' "${BACKEND_PORT}" | base64)

                        ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER_HOST}" \
                        "PASS_B64='${PASS_B64}' USER_B64='${USER_B64}' IMAGE_B64='${IMAGE_B64}' NAME_B64='${NAME_B64}' ENV_FILE_B64='${ENV_FILE_B64}' BACKEND_HOST_B64='${BACKEND_HOST_B64}' BACKEND_PORT_B64='${BACKEND_PORT_B64}' bash -s" <<'REMOTE'
set -e
DOCKER_PASS=$(echo "$PASS_B64" | base64 -d)
DOCKER_USER=$(echo "$USER_B64" | base64 -d)
FULL_IMAGE=$(echo "$IMAGE_B64" | base64 -d)
CONTAINER_NAME=$(echo "$NAME_B64" | base64 -d)
CONTAINER_ENV_FILE=$(echo "$ENV_FILE_B64" | base64 -d)
BACKEND_HOST=$(echo "$BACKEND_HOST_B64" | base64 -d)
BACKEND_PORT=$(echo "$BACKEND_PORT_B64" | base64 -d)

echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
docker pull "$FULL_IMAGE"
docker rm -f "$CONTAINER_NAME" || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network flask-app \
  -e BACKEND_HOST="$BACKEND_HOST" \
  -e BACKEND_PORT="$BACKEND_PORT" \
  --env-file "$CONTAINER_ENV_FILE" \
  "$FULL_IMAGE"
REMOTE
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
