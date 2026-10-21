#!/usr/bin/env bash
# Check that local development services are running
# Usage: bash scripts/check-services.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    local name="$1"
    local host="$2"
    local port="$3"

    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name is running on $host:$port"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT running on $host:$port"
        return 1
    fi
}

echo "Checking local development services..."
echo ""

FAIL=0

check_service "PostgreSQL" "localhost" "5432" || FAIL=1
check_service "Qdrant" "localhost" "6333" || FAIL=1

echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}All services are running.${NC}"
else
    echo -e "${YELLOW}Some services are not running. Please start them before continuing.${NC}"
    echo ""
    echo "PostgreSQL: Start via your system package manager or pgAdmin"
    echo "Qdrant:     Start via 'qdrant' binary or download from https://qdrant.tech"
fi

exit $FAIL
