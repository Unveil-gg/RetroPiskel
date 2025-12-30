/**
 * DefaultConsoleMode - Standard Piskel mode with no restrictions.
 *
 * This is the default mode when no specific console is targeted.
 * Provides unrestricted palette, colors, and dimensions.
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * Creates and registers the default console mode.
   * @return {pskl.consoles.ConsoleMode}
   */
  ns.createDefaultMode = function () {
    return new pskl.consoles.ConsoleMode({
      id: 'default',
      name: 'Original Piskel',
      bodyClass: 'console-default',
      palette: null,      // Unrestricted
      maxColors: null,    // Unlimited
      tileSize: null,     // No tile constraint
      exportTabs: [],     // Base tabs only
      themeVariables: {
        '--highlight-color': 'gold'
      },
      badgeText: null     // No badge
    });
  };
})();

