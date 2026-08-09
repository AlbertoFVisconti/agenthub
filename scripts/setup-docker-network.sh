#!/bin/bash
set -e

# Creates a secured Docker network for AgentHub egress tools
# Blocks RFC1918 private IP ranges and cloud metadata service (169.254.169.254)

NETWORK_NAME="agenthub-egress"

if docker network ls --format '{{.Name}}' | grep -wq "^$NETWORK_NAME$"; then
  echo "Network $NETWORK_NAME already exists. Recreating..."
  docker network rm $NETWORK_NAME
fi

# Create a bridge network
docker network create --driver bridge $NETWORK_NAME

# Find the bridge interface name for this network
# docker network inspect outputs something like "br-XXXXXXX"
BRIDGE_ID=$(docker network inspect $NETWORK_NAME --format '{{.Id}}' | cut -c1-12)
INTERFACE="br-$BRIDGE_ID"

echo "Interface for $NETWORK_NAME is $INTERFACE"

# Flush any existing rules for this interface in DOCKER-USER chain
iptables -D DOCKER-USER -i $INTERFACE -j RETURN 2>/dev/null || true
iptables -D DOCKER-USER -o $INTERFACE -j RETURN 2>/dev/null || true

# Block cloud metadata service
iptables -I DOCKER-USER 1 -i $INTERFACE -d 169.254.169.254/32 -j DROP

# Block RFC1918 internal networks
iptables -I DOCKER-USER 2 -i $INTERFACE -d 10.0.0.0/8 -j DROP
iptables -I DOCKER-USER 3 -i $INTERFACE -d 172.16.0.0/12 -j DROP
iptables -I DOCKER-USER 4 -i $INTERFACE -d 192.168.0.0/16 -j DROP

echo "Network $NETWORK_NAME created and secured via iptables."
