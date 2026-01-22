// Runtime config for the static frontend. Edit this file (or set window.CONFIG before it loads)
// to point the UI at the correct backend and Stripe publishable key.
(function bootstrapConfig() {
  const placeholderApi = 'https://servi-preauth.onrender.com';
  const placeholderPk = 'pk_live_51QzK6tG7utWo2rQv6la6tTL3pXXWiw2cUXUfnPeMtNEzywIa7AmQiRZgFFFxSmSTYdHoaD8Mel6gTQBHi5c7oINm00Tu5bdEHo';

  const explicit = window.CONFIG || {};
  const rawApi =
    explicit.API_BASE ||
    window.CONFIG_API_BASE ||
    window.SERVI_API_BASE ||
    (placeholderApi !== '__API_BASE__' ? placeholderApi : '') ||
    '';
  const normalizedApi = (rawApi || '').replace(/\/+$/, '') || window.location.origin;

  const rawPk =
    explicit.STRIPE_PUBLISHABLE_KEY ||
    window.CONFIG_STRIPE_PUBLISHABLE_KEY ||
    window.STRIPE_PUBLISHABLE_KEY ||
    (placeholderPk !== 'pk_live_51QzK6tG7utWo2rQv6la6tTL3pXXWiw2cUXUfnPeMtNEzywIa7AmQiRZgFFFxSmSTYdHoaD8Mel6gTQBHi5c7oINm00Tu5bdEHo' ? placeholderPk : '') ||
    '';

  window.CONFIG = {
    API_BASE: normalizedApi,
    STRIPE_PUBLISHABLE_KEY: rawPk
  };
})();
