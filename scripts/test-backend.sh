#!/bin/bash
# ManjarChat backend end-to-end test
B=http://localhost:3000/api
J=/tmp/mjtest
mkdir -p $J && rm -f $J/*.txt
PASS=0; FAIL=0

check() { # name, expected_json_fragment
  local name="$1"; local frag="$2"; local data="$3"
  if echo "$data" | grep -q "$frag"; then PASS=$((PASS+1)); echo "PASS: $name";
  else FAIL=$((FAIL+1)); echo "FAIL: $name → $data"; fi
}

# health
check health '"ok":true' "$(curl -s $B/health)"

# admin login (seeded account manjar1388 / 13881388)
R=$(curl -s -c $J/admin.txt -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"manjar1388","password":"13881388"}')
check admin_login '"role":"ADMIN"' "$R"
check admin_balance '1000000' "$R"

# register two users (welcome bonus 100) — fallback to login if they exist
R=$(curl -s -c $J/u1.txt -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"username":"ali_test","password":"test1234","displayName":"علی تست"}')
if echo "$R" | grep -q 'قبلا'; then R=$(curl -s -c $J/u1.txt -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"ali_test","password":"test1234"}'); fi
check register_u1 '"manjarBalance"' "$R"
R=$(curl -s -c $J/u2.txt -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"username":"sara_test","password":"test1234","displayName":"سارا تست"}')
if echo "$R" | grep -q 'قبلا'; then R=$(curl -s -c $J/u2.txt -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"sara_test","password":"test1234"}'); fi
check register_u2 '"manjarBalance"' "$R"

# duplicate register
R=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"username":"ali_test","password":"test1234"}')
check register_dup 'قبلا' "$R"

# me
R=$(curl -s -b $J/u1.txt $B/auth/me)
check me '"username":"ali_test"' "$R"

# users directory
R=$(curl -s -b $J/u1.txt "$B/users?q=sara")
check users_dir 'sara_test' "$R"

# DM creation
R=$(curl -s -b $J/u1.txt -X POST $B/conversations -H 'Content-Type: application/json' -d '{"type":"DM","peerUsername":"sara_test"}')
check dm_create '"conversationId"' "$R"
DM=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['conversationId'])")

# send text message
R=$(curl -s -b $J/u1.txt -X POST $B/conversations/$DM/messages -H 'Content-Type: application/json' -d '{"kind":"TEXT","content":"سلام سارا! این از منجرچت است 🪙"}')
check dm_msg '"kind":"TEXT"' "$R"
MSGID=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['message']['id'])")

# sara sees it
R=$(curl -s -b $J/u2.txt $B/conversations)
check sara_unread 'سلام سارا' "$R"

# react + pin
R=$(curl -s -b $J/u2.txt -X PATCH $B/messages/$MSGID -H 'Content-Type: application/json' -d '{"action":"react","emoji":"❤️"}')
check react '"count":1' "$R"
R=$(curl -s -b $J/u1.txt -X PATCH $B/messages/$MSGID -H 'Content-Type: application/json' -d '{"action":"pin"}')
check pin '"pinned":true' "$R"

# typing + read
R=$(curl -s -b $J/u2.txt -X POST $B/conversations/$DM/typing)
check typing '"ok":true' "$R"
R=$(curl -s -b $J/u2.txt -X POST $B/conversations/$DM/read)
check read '"ok":true' "$R"

# incremental poll
R=$(curl -s -b $J/u2.txt "$B/conversations/$DM/messages?after=2000-01-01T00:00:00.000Z")
check poll_after '"ali_test"' "$R"

# wallet + checkin
R=$(curl -s -b $J/u1.txt $B/wallet)
check wallet '"canCheckin"' "$R"
R=$(curl -s -b $J/u1.txt -X POST $B/wallet/checkin)
check checkin 'چک‌این\|"balance"' "$R"
R=$(curl -s -b $J/u1.txt -X POST $B/wallet/checkin)
check checkin_twice 'چک‌این' "$R"

# shop buy gift → sara receives
R=$(curl -s -b $J/u1.txt -X POST $B/shop/buy -H 'Content-Type: application/json' -d '{"itemKey":"gift_rose","recipientUsername":"sara_test","note":"گل برای تو"}')
check buy_gift '"kind":"GIFT"' "$R"

# premium purchase with a fresh broke user → insufficient
R=$(curl -s -c $J/poor.txt -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"username":"poor_'$RANDOM'","password":"test1234"}')
R=$(curl -s -b $J/poor.txt -X POST $B/shop/buy -H 'Content-Type: application/json' -d '{"itemKey":"premium_30"}')
check buy_premium_insufficient 'کافی نیست' "$R"

# admin mints 1000 to sara, then premium works
SARA_ID=$(curl -s -b $J/admin.txt "$B/admin/users?q=sara" | python3 -c "import json,sys; print(json.load(sys.stdin)['users'][0]['id'])")
R=$(curl -s -b $J/admin.txt -X PATCH $B/admin/users -H 'Content-Type: application/json' -d "{\"userId\":\"$SARA_ID\",\"action\":\"mint\",\"amount\":1000}")
check mint_ok '"balance"' "$R"
R=$(curl -s -b $J/u2.txt -X POST $B/shop/buy -H 'Content-Type: application/json' -d '{"itemKey":"premium_30"}')
check buy_premium '"kind":"PREMIUM"' "$R"

# group creation + boost (admin tops up ali first)
R=$(curl -s -b $J/u1.txt -X POST $B/conversations -H 'Content-Type: application/json' -d '{"type":"GROUP","title":"گروه تستی","memberUsernames":["sara_test"]}')
GROUP=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['conversationId'])")
ALI_ID=$(curl -s -b $J/admin.txt "$B/admin/users?q=ali" | python3 -c "import json,sys; print(json.load(sys.stdin)['users'][0]['id'])")
curl -s -b $J/admin.txt -X PATCH $B/admin/users -H 'Content-Type: application/json' -d "{\"userId\":\"$ALI_ID\",\"action\":\"mint\",\"amount\":500}" > /dev/null
R=$(curl -s -b $J/u1.txt -X POST $B/shop/buy -H 'Content-Type: application/json' -d "{\"itemKey\":\"boost_10\",\"conversationId\":\"$GROUP\"}")
check boost '"kind":"BOOST"' "$R"

# public group exists in list
R=$(curl -s -b $J/u1.txt $B/conversations)
check public_group 'عمومی' "$R"

# voice upload (fake webm) + send + media fetch
head -c 2048 /dev/urandom > $J/voice.webm
R=$(curl -s -b $J/u1.txt -F "file=@$J/voice.webm;type=audio/webm" $B/upload)
check upload '"mime":"audio/webm"' "$R"
MID=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['media']['id'])")
R=$(curl -s -b $J/u1.txt -X POST $B/conversations/$DM/messages -H 'Content-Type: application/json' -d "{\"kind\":\"VOICE\",\"mediaId\":\"$MID\",\"durationMs\":4200}")
check send_voice '"kind":"VOICE"' "$R"
CODE=$(curl -s -o /dev/null -w '%{http_code}' $B/media/$MID)
check media_serve '200' "$CODE"

# image upload
head -c 1024 /dev/urandom > $J/pic.png
R=$(curl -s -b $J/u1.txt -F "file=@$J/pic.png;type=image/png" $B/upload)
check upload_img '"mime":"image/png"' "$R"

# admin stats
R=$(curl -s -b $J/admin.txt $B/admin/stats)
check admin_stats '"manjarInCirculation"' "$R"
R=$(curl -s -b $J/u1.txt $B/admin/stats)
check admin_forbidden 'unauthorized' "$R"

# admin broadcast
R=$(curl -s -b $J/admin.txt -X POST $B/admin/broadcast -H 'Content-Type: application/json' -d '{"content":"نسخه جدید منجرچت منتشر شد! 🎉"}')
check broadcast '"sent"' "$R"

# admin transactions
R=$(curl -s -b $J/admin.txt $B/admin/transactions)
check admin_txs 'WELCOME' "$R"

# admin conversations
R=$(curl -s -b $J/admin.txt $B/admin/conversations)
check admin_convs 'گروه تستی' "$R"

# unauthorized access
CODE=$(curl -s -o /dev/null -w '%{http_code}' $B/conversations)
check noauth_401 '401' "$CODE"

echo ""
echo "=============================="
echo "PASSED: $PASS  FAILED: $FAIL"
