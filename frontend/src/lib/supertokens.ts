import SuperTokens from "supertokens-web-js";
import EmailPassword from "supertokens-web-js/recipe/emailpassword";
import Session from "supertokens-web-js/recipe/session";

let initialized = false;

export function initSuperTokens() {
  if (initialized) {
    return;
  }

  SuperTokens.init({
    appInfo: {
      appName: "TEA-PTS",
      apiDomain: "http://localhost:3000",
      apiBasePath: "/auth",
    },

    recipeList: [
      EmailPassword.init(),
      Session.init(),
    ],
  });

  initialized = true;
}