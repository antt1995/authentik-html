DIST_DIR=/dist
cp -R web/dist/* $DIST_DIR

#---CUSTOM BACKGROUND
if [ ! -z "$AUTHENTIK_FLOW_BACKGROUND_URL" ]; then
    curl -fsSL -o $DIST_DIR/assets/images/flow_background.jpg $AUTHENTIK_FLOW_BACKGROUND_URL
fi

#---CUSTOM ICON
if [ ! -z "$AUTHENTIK_BRAND_ICON_URL" ]; then
    curl -fsSL -o $DIST_DIR/assets/icons/icon_left_brand.svg $AUTHENTIK_BRAND_ICON_URL
fi

#---HIDE FOOTER CONTENT
for FILE in $DIST_DIR/flow/*; do
    FILTERS="https://goauthentik.io https://unsplash.com"
    for FILTER in $FILTERS; do
        sed -i "s|href=\"$FILTER|style=\"display:none !important\" href=\"$FILTER|g" $FILE
    done
done

#---INJECT URLS
printf "\n\n//***** AKUtils Sscript *****\n\n" >> $DIST_DIR/poly.js
if [ ! -z "$AUTHENTIK_UTILS_SCRIPT_URL" ]; then
    curl -fsSL $AUTHENTIK_UTILS_SCRIPT_URL >> $DIST_DIR/poly.js
else
    command -v jq >/dev/null 2>&1 || { echo "installing jq"; curl -fsSL https://glare.vercel.app/stedolan/jq/linux64 -o /usr/bin/jq; chmod +x /usr/bin/jq; }
    curl -fsSL https://api.github.com/repos/regbo/public-html/contents/authentik/authentik-utils.js | jq -r ".content" | base64 --decode  >> $DIST_DIR/poly.js
fi
AUTHENTIK_INJECT_URLS=""
while IFS='=' read -r -d '' n v; do
    if [[ $n = AUTHENTIK_INJECT_URL* ]]; then
        AUTHENTIK_INJECT_URLS+=$(echo " $v")
    fi
done < <(env -0 | sort -z)
sed -i "s|{{AUTHENTIK_INJECT_URLS}}|$AUTHENTIK_INJECT_URLS|g" $DIST_DIR/poly.js


/usr/local/bin/dumb-init -- /lifecycle/ak worker