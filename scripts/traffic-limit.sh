#!/bin/bash
set -e

# Helper script to limit traffic for iface:port
# http://www.codeoriented.com/how-to-limit-network-bandwidth-for-a-specific-tcp-port-on-ubuntu-linux/
# https://wiki.archlinux.org/index.php/Advanced_traffic_control

if ! which tc &>/dev/null ; then
  2>&1 echo Error: tc executable not found
  2>&1 echo Please install iproute2 package
  exit 1
fi

IFACE=$1
RATE=$3
PORT=$2

if [ -z "$3" ] ; then
  echo "Traffic limitter"
  echo "Usage: $0 IFACE PORT RATE"
  echo
  echo "Available interfaces: $(ls -m /sys/class/net)"
  echo
  echo "Rate units: "
  echo "  kbps: Kilobytes per Second"
  echo "  mbps: Megabytes per Second"
  echo "  gbps: Gigabytes per Second"
  echo "  off: No rate limit"
  echo
  echo "Examples:"
  echo "  $0 wlan0 8080 10kbps"
  echo "  $0 wlan0 8080 off"
  exit 1
fi

sudo tc qdisc del root dev $IFACE &>/dev/null || true

[ "$RATE" = "off" ] && exit

sudo tc qdisc add dev $IFACE root handle 1:0 htb default 10
sudo tc class add dev $IFACE parent 1:0 classid 1:10 htb rate $RATE  prio 0
sudo tc filter add dev $IFACE parent 1:0 prio 0 protocol ip u32 match ip protocol 4 0xff match ip dport $PORT 0xffff flowid 1:10
sudo tc qdisc show dev $IFACE
