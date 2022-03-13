alias db=" mycli -h $(docker inspect --format '{{ .NetworkSettings.IPAddress }}' mysql) -u root -proot"
alias rgns-db=" mssql-cli -S mssql-rgns-dev.ckyd1jsd7pkj.us-east-1.rds.amazonaws.com -U admin -P regionsdev2021 -d Central_DEV"
alias redis-cluster="cd ~/Software/redis-6.2.3/utils/create-cluster && ./create-cluster start"
alias redis-server="~/Software/redis-5.0.13/src/redis-server"

kDescribe () {
  k -n $1 describe deployment "$1-$2"
}

kTop () {
  k -n $1 top pod
}

kGetIngress () {
  k -n $1 get ingress
}

kGetPods () {
  k -n $1 get pods
}

kExecPod () {
  pod=$(k -n $1 get pods | grep "$2" | awk '{ print $1 }')

  k -n $1 exec -it $pod -- $3
}

kLogs () {
  pod=$(k -n $1 get pods | grep "$2" | grep -v "\-db\-\|redis" | awk '{ print $1 }')

  k -n $1 logs $pod
}

kGetDbPass () {
  pod=$(k -n $1 get pods | grep "\-db\-" | grep "$2" | awk '{ print $1 }')

  k -n $1 describe pod $pod | grep "PASS" | awk '{ print $2 }'
}

redisUncompress () {
  base64 --decode<<< $1 | gunzip -cd
}

de () {
  DOTENV_CONFIG_PATH=$1 node \
    -r dotenv/config \
    --harmony ./bin/index.js
  }

gateway () {
  gatewaytype=$1
  gatewayConfigPath="/home/i337/fp/winter-5/fp-api-gateway/config"

  docker run \
    --name gateway-$gatewaytype \
    --network="host" \
    --volume $gatewayConfigPath/$gatewaytype-gateway.config.yml:/var/lib/eg/gateway.config.yml \
    --volume $gatewayConfigPath/jwtSecret.pub:/var/secrets/jwtSecret.pub \
    --rm gateway-$1
  }

saas () {
  cd ~/fp/winter-5/fp-saas && NODE_ENV=$1 npm start
}

wa () {
  cd ~/fp/winter-5/washington && \
  TZ="Etc/Utc" \
  DOTENV_CONFIG_PATH=$1 nodemon \
    -r dotenv/config \
    --max_old_space_size=5120 \
    --harmony index.js
}

fpeg () {
        cd ~/fp/winter-5/fpeg && NODE_ENV=$1 SINGLE_PROCESS=true npm start
}

chpwdHook () {
  case "$PWD" in
    "/home/i337/fp/fp-env")
      pyenv activate fpenv
      ;;
    *fall-7*)
      fnm use fall7
      ;;
  esac
}

logs() {
        #PODS="$(k -n $1 get pod --no-headers | grep $2 | awk '{print $1}')"
        for p in `k -n $1 get pod --no-headers | grep $2 | awk '{print $1}'`; do
                k -n $1 logs $p
        done
}

add-zsh-hook chpwd chpwdHook
