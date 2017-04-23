#!/bin/bash

# http://www.codeoriented.com/how-to-limit-network-bandwidth-for-a-specific-tcp-port-on-ubuntu-linux/

IF=$2
BAND=$1
PORT=$3

if [ -z "$3" ] ; then
  echo $0 10kbps wlan0 8080
  exit 1
fi

tc qdisc del root dev $IF
tc qdisc add dev $IF root handle 1:0 htb default 10
tc class add dev $IF parent 1:0 classid 1:10 htb rate $BAND  prio 0
tc filter add dev $IF parent 1:0 prio 0 protocol ip u32 match ip protocol 4 0xff match ip dport $PORT 0xffff flowid 1:10
tc qdisc show dev $IF
