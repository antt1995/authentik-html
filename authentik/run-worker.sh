DIST_DIR=/dist
WEB_DIST_DIR=web/dist
echo "copying ${WEB_DIST_DIR}"
cp -v -R "${WEB_DIST_DIR}"/* $DIST_DIR

#---CUSTOM BACKGROUND
if [ ! -z "$AUTHENTIK_FLOW_BACKGROUND_URL" ]; then
    curl -fsSL -o $DIST_DIR/assets/images/flow_background.jpg $AUTHENTIK_FLOW_BACKGROUND_URL
fi
echo "AUTHENTIK_FLOW_BACKGROUND_URL:${AUTHENTIK_FLOW_BACKGROUND_URL}"

#---CUSTOM ICON
if [ ! -z "$AUTHENTIK_BRAND_ICON_URL" ]; then
    curl -fsSL -o $DIST_DIR/assets/icons/icon_left_brand.svg $AUTHENTIK_BRAND_ICON_URL
fi
echo "AUTHENTIK_BRAND_ICON_URL:${AUTHENTIK_BRAND_ICON_URL}"

#---HIDE FOOTER CONTENT
for FILE in $DIST_DIR/flow/*; do
    FILTERS="https://goauthentik.io https://unsplash.com"
    for FILTER in $FILTERS; do
        echo "FILTER:${FILTER}"
        sed -i "s|href=\"$FILTER|style=\"display:none !important\" href=\"$FILTER|g" $FILE
    done
done

#---INJECT URLS
printf "\n\n//***** AKUtils Script Start *****\n\n" >> $DIST_DIR/poly.js
if [ ! -z "$AUTHENTIK_UTILS_SCRIPT_URL" ] || [ command -v jq >/dev/null 2>&1 ]; then
    echo "AUTHENTIK_UTILS_SCRIPT_URL:${AUTHENTIK_UTILS_SCRIPT_URL}"
    curl -fsSL $AUTHENTIK_UTILS_SCRIPT_URL >> $DIST_DIR/poly.js
else
    curl -fsSL https://api.github.com/repos/regbo/public-html/contents/authentik/authentik-utils.js | jq -r ".content" | base64 --decode >> $DIST_DIR/poly.js
fi
AUTHENTIK_INJECT_JS_URLS=""
while IFS='=' read -r -d '' NAME VALUE; do
    if [[ $NAME = AUTHENTIK_INJECT_CSS_URL* ]]; then
        echo "${NAME}:${VALUE}"
        printf "\n\n/* ${VALUE} */\n\n" >> $DIST_DIR/custom.css
        curl -fsSL $VALUE >> $DIST_DIR/custom.css
    fi
    if [[ $NAME = AUTHENTIK_INJECT_JS_URL* ]]; then
        echo "${NAME}:${VALUE}"
        AUTHENTIK_INJECT_JS_URLS+=$(echo " $VALUE")
    fi
done < <(env -0 | sort -z)
sed -i "s|{{AUTHENTIK_INJECT_JS_URLS}}|$AUTHENTIK_INJECT_JS_URLS|g" $DIST_DIR/poly.js
printf "\n\n//***** AKUtils Script END *****\n\n" >> $DIST_DIR/poly.js

/usr/local/bin/dumb-init -- /lifecycle/ak worker
