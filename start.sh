#!/bin/bash
COMMAND="./node_modules/forever/bin/forever"
UPTIME=60000
SLEEP=1000
CURRENT=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
SERVICE="$CURRENT/services"
LOGDIR="$CURRENT/logs"
SERVICES=$( ls $CURRENT/services )

for f in $SERVICES
do
	$COMMAND start -l $LOGDIR/$f --minUptime $UPTIME --spinSleepTime $SLEEP services/$f
done