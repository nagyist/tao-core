define(["jquery", "context", "util/cookies", "util/encode"], function (
  $,
  context,
  cookies,
  encode
) {
  const cookieStorage = cookies.createCookieStorage({ domainLevel: 2 });

/**
 * Initializes analytics tools.
 */
function initAnalytics() {
  if (window.initGoogleAnalytics) {
    window.initGoogleAnalytics();
  }
  if (window.initUserpilot) {
    window.initUserpilot();
  }
}

  /**
   * Returns the cookie name using SHA-256 of tenantId-userLogin.
   * @returns {Promise<string|null>}
   */
  async function getUserCookieName() {
    const tenantId = context.tenantId;
    const userLogin = context.currentUser.login;

    if (!tenantId|| !userLogin) return null;
    return `CookiePolicy-${await encode.stringToSha256(`${tenantId}-${userLogin}`)}`;
  }

  /**
   * Sets the cookie consent preferences.
   * @param {object} value
   */
  async function setCookiesPolicy(value) {
    const cookieKey = await getUserCookieName();
    cookieStorage.setItem(cookieKey, value);
    if (value.analytics) {
      initAnalytics();
    }
  }

  return {
    init: async function () {
      const $banner = $("#cookies-banner");
      const $acceptButton = $("#accept-cookies");
      const $declineButton = $("#decline-cookies");
      const $cookiesPreferencesBlock = $("#cookies-preferences");
      const $cookiesMessageBlock = $("#cookies-message");
      const $toggleBannerMessage = $("#cookies-preferences-link");
      const userCookieName = await getUserCookieName();

      if (userCookieName) {
        const cookieValue = cookieStorage.getItem(userCookieName);
        if (cookieValue) {
          const isAnalyticsEnabled = cookieValue.analytics;
          if (isAnalyticsEnabled) {
            initAnalytics();
          }
          return; // Don't show banner
        }
      }

      $banner.show();

      $acceptButton.on("click", function () {
        const isAnalyticsChecked = $cookiesPreferencesBlock.is(":visible")
          ? $("#analytics-toggle").prop("checked")
          : true;
        setCookiesPolicy({ essentials: true, analytics: isAnalyticsChecked });
        $banner.hide();
      });

      $declineButton.on("click", function () {
        setCookiesPolicy({ essentials: true, analytics: false });
        $banner.hide();
      });

      $($toggleBannerMessage).on("click", function (e) {
        e.preventDefault();
        $cookiesPreferencesBlock.toggle();
        $cookiesMessageBlock.toggle();
        $toggleBannerMessage.hide();
        $acceptButton.text($acceptButton.data("confirm-text") || "Confirm choices");
      });
    },
  };
});
