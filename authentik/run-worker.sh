DIST_DIR=/dist
echo "copying - ${DIST_DIR}"
yes | cp -rfv web/dist/* $DIST_DIR

copyURLToFile () {
    if [ ! -z "$1" ]; then
        TMP_FILE=$(mktemp)
        curl -fsSL $1 -o $TMP_FILE
        chmod 644 $TMP_FILE
        mv $TMP_FILE $2
    fi
}

#---CUSTOM BACKGROUND
copyURLToFile $AUTHENTIK_FLOW_BACKGROUND_URL $DIST_DIR/assets/images/flow_background.jpg
copyURLToFile $AUTHENTIK_BRAND_ICON_URL $DIST_DIR/assets/icons/icon_left_brand.svg

#---HIDE FOOTER CONTENT
for FILE in $DIST_DIR/flow/*; do
    FILTERS="https://goauthentik.io https://unsplash.com"
    for FILTER in $FILTERS; do
        sed -i "s|href=\"$FILTER|style=\"display:none !important\" href=\"$FILTER|g" $FILE
    done
done

#---INJECT URLS
printf "\n\n//***** AKUtils Script Start *****\n\n" >> $DIST_DIR/poly.js
if [ ! -z "$AUTHENTIK_UTILS_SCRIPT_URL" ] || [ command -v jq >/dev/null 2>&1 ]; then
    curl -fsSL $AUTHENTIK_UTILS_SCRIPT_URL >> $DIST_DIR/poly.js
else
    curl -fsSL https://raw.githubusercontent.com/antt1995/authentik-html/master/authentik/authentik-utils.js | jq -r ".content" | base64 --decode >> $DIST_DIR/poly.js
fi
AUTHENTIK_INJECT_JS_URLS=""
while IFS='=' read -r -d '' NAME VALUE; do
    if [[ $NAME = AUTHENTIK_INJECT_CSS_URL* ]]; then
        echo "injecting css:${VALUE}"
        printf "\n\n/* ${VALUE} */\n\n" >> $DIST_DIR/custom.css
        curl -fsSL $VALUE >> $DIST_DIR/custom.css
    fi
    if [[ $NAME = AUTHENTIK_INJECT_JS_URL* ]]; then
        echo "injecting js:${VALUE}"
        AUTHENTIK_INJECT_JS_URLS+=$(echo " $VALUE")
    fi
done < <(env -0 | sort -z)
sed -i "s|{{AUTHENTIK_INJECT_JS_URLS}}|$AUTHENTIK_INJECT_JS_URLS|g" $DIST_DIR/poly.js
printf "\n\n//***** AKUtils Script END *****\n\n" >> $DIST_DIR/poly.js

/usr/local/bin/dumb-init -- /lifecycle/ak worker
