(function () {
  var ns = $.namespace('pskl.controller.settings.preferences');

  ns.MiscPreferencesController = function (piskelController, preferencesController) {
    this.piskelController = piskelController;
    this.preferencesController = preferencesController;
  };

  pskl.utils.inherit(ns.MiscPreferencesController, pskl.controller.settings.AbstractSettingController);

  ns.MiscPreferencesController.prototype.init = function () {
    // Console Mode selector
    this.consoleModeSelect_ = document.querySelector('.console-mode-select');
    this.populateConsoleModeOptions_();
    this.addEventListener(
      this.consoleModeSelect_, 'change', this.onConsoleModeChange_);

    // Color Replace Prompt toggle (visible when console has restrictions)
    this.colorReplaceSetting_ = document.querySelector('.color-replace-setting');
    var colorReplaceCheckbox = document.querySelector(
      '.color-replace-prompt-checkbox');
    if (colorReplaceCheckbox) {
      colorReplaceCheckbox.checked = pskl.UserSettings.get(
        pskl.UserSettings.COLOR_REPLACE_PROMPT);
      this.addEventListener(
        colorReplaceCheckbox, 'change', this.onColorReplacePromptChange_);
    }
    // Set initial visibility based on console mode
    this.updateColorReplaceSettingVisibility_();

    this.backgroundContainer = document.querySelector('.background-picker-wrapper');
    this.addEventListener(this.backgroundContainer, 'click', this.onBackgroundClick_);

    // Highlight selected background :
    var background = pskl.UserSettings.get(pskl.UserSettings.CANVAS_BACKGROUND);
    var selectedBackground = this.backgroundContainer.querySelector('[data-background=' + background + ']');
    if (selectedBackground) {
      selectedBackground.classList.add('selected');
    }

    // Max FPS
    var maxFpsInput = document.querySelector('.max-fps-input');
    maxFpsInput.value = pskl.UserSettings.get(pskl.UserSettings.MAX_FPS);
    this.addEventListener(maxFpsInput, 'change', this.onMaxFpsChange_);

    // Color format
    var colorFormat = pskl.UserSettings.get(pskl.UserSettings.COLOR_FORMAT);
    var colorFormatSelect = document.querySelector('.color-format-select');
    var selectedColorFormatOption = colorFormatSelect.querySelector('option[value="' + colorFormat + '"]');
    if (selectedColorFormatOption) {
      selectedColorFormatOption.setAttribute('selected', 'selected');
    }
    this.addEventListener(colorFormatSelect, 'change', this.onColorFormatChange_);

    // Layer preview opacity
    var layerOpacityInput = document.querySelector('.layer-opacity-input');
    layerOpacityInput.value = pskl.UserSettings.get(pskl.UserSettings.LAYER_OPACITY);
    this.addEventListener(layerOpacityInput, 'change', this.onLayerOpacityChange_);
    this.addEventListener(layerOpacityInput, 'input', this.onLayerOpacityChange_);
    this.updateLayerOpacityText_(layerOpacityInput.value);
  };

  ns.MiscPreferencesController.prototype.onBackgroundClick_ = function (evt) {
    var target = evt.target;
    var background = target.dataset.background;
    if (background) {
      pskl.UserSettings.set(pskl.UserSettings.CANVAS_BACKGROUND, background);
      var selected = this.backgroundContainer.querySelector('.selected');
      if (selected) {
        selected.classList.remove('selected');
      }
      target.classList.add('selected');
    }
  };

  ns.MiscPreferencesController.prototype.onColorFormatChange_ = function (evt) {
    pskl.UserSettings.set(pskl.UserSettings.COLOR_FORMAT, evt.target.value);
  };

  ns.MiscPreferencesController.prototype.onMaxFpsChange_ = function (evt) {
    var target = evt.target;
    var fps = parseInt(target.value, 10);
    if (fps && !isNaN(fps)) {
      pskl.UserSettings.set(pskl.UserSettings.MAX_FPS, fps);
    } else {
      target.value = pskl.UserSettings.get(pskl.UserSettings.MAX_FPS);
    }
  };

  ns.MiscPreferencesController.prototype.onLayerOpacityChange_ = function (evt) {
    var target = evt.target;
    var opacity = parseFloat(target.value);
    if (!isNaN(opacity)) {
      pskl.UserSettings.set(pskl.UserSettings.LAYER_OPACITY, opacity);
      pskl.UserSettings.set(pskl.UserSettings.LAYER_PREVIEW, opacity !== 0);
      this.updateLayerOpacityText_(opacity);
    } else {
      target.value = pskl.UserSettings.get(pskl.UserSettings.LAYER_OPACITY);
    }
  };

  ns.MiscPreferencesController.prototype.updateLayerOpacityText_ = function (opacity) {
    var layerOpacityText = document.querySelector('.layer-opacity-text');
    layerOpacityText.innerHTML = (opacity * 1).toFixed(2);
  };

  /**
   * Populates the console mode dropdown with available modes.
   * @private
   */
  ns.MiscPreferencesController.prototype.populateConsoleModeOptions_ =
    function () {
      if (!this.consoleModeSelect_ || !pskl.app.consoleRegistry) {
        return;
      }

      var select = this.consoleModeSelect_;
      var currentModeId = pskl.UserSettings.get(pskl.UserSettings.CONSOLE_MODE);
      var modes = pskl.app.consoleRegistry.getAll();

      // Clear existing options
      select.innerHTML = '';

      // Add an option for each registered console mode
      modes.forEach(function (mode) {
        var option = document.createElement('option');
        option.value = mode.id;
        option.textContent = mode.name;
        if (mode.id === currentModeId) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    };

  /**
   * Handles console mode selection change.
   * @param {Event} evt - Change event
   * @private
   */
  ns.MiscPreferencesController.prototype.onConsoleModeChange_ = function (evt) {
    var newModeId = evt.target.value;
    var currentModeId = pskl.UserSettings.get(pskl.UserSettings.CONSOLE_MODE);

    if (newModeId === currentModeId) {
      return;
    }

    var confirmed = this.confirmConsoleModeChange_(currentModeId, newModeId);

    if (confirmed) {
      pskl.UserSettings.set(pskl.UserSettings.CONSOLE_MODE, newModeId);
      this.updateColorReplaceSettingVisibility_();

      // Offer to resize to console's recommended dimensions
      this.promptDefaultSizeChange_(newModeId);
    } else {
      // Revert selection to previous mode
      evt.target.value = currentModeId;
    }
  };

  /**
   * Prompts user to resize canvas to console's recommended size.
   * Only prompts if the canvas is empty or small enough to benefit.
   * @param {string} modeId - The new console mode ID
   * @private
   */
  ns.MiscPreferencesController.prototype.promptDefaultSizeChange_ = function (
    modeId
  ) {
    var registry = pskl.app.consoleRegistry;
    var mode = registry.get(modeId);

    if (!mode || !mode.defaultSize) {
      return;
    }

    var currentWidth = this.piskelController.getWidth();
    var currentHeight = this.piskelController.getHeight();
    var recWidth = mode.defaultSize.width;
    var recHeight = mode.defaultSize.height;

    // Skip if already at recommended size
    if (currentWidth === recWidth && currentHeight === recHeight) {
      return;
    }

    // Only prompt if canvas is empty (no work to lose)
    if (!this.piskelController.isEmpty()) {
      return;
    }

    var msg = mode.name + ' recommends ' + recWidth + '×' + recHeight +
      ' sprites.\n\n' +
      'Your current canvas is ' + currentWidth + '×' + currentHeight + '.\n\n' +
      'Resize to ' + recWidth + '×' + recHeight + '?';

    if (window.confirm(msg)) {
      this.resizeToDefaultSize_(recWidth, recHeight);
    }
  };

  /**
   * Resizes the canvas to the specified dimensions.
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @private
   */
  ns.MiscPreferencesController.prototype.resizeToDefaultSize_ = function (
    width, height
  ) {
    var currentPiskel = this.piskelController.getPiskel();
    var resizedPiskel = pskl.utils.ResizeUtils.resizePiskel(currentPiskel, {
      width: width,
      height: height,
      resizeContent: false,
      origin: 'TOPLEFT'
    });
    pskl.app.piskelController.setPiskel(resizedPiskel);
    $.publish(Events.PISKEL_RESET);
  };

  /**
   * Handles color replace prompt checkbox toggle.
   * @param {Event} evt - Change event
   * @private
   */
  ns.MiscPreferencesController.prototype.onColorReplacePromptChange_ =
    function (evt) {
      pskl.UserSettings.set(
        pskl.UserSettings.COLOR_REPLACE_PROMPT,
        evt.target.checked);
    };

  /**
   * Shows/hides color replace setting based on console mode restrictions.
   * @private
   */
  ns.MiscPreferencesController.prototype.updateColorReplaceSettingVisibility_ =
    function () {
      if (!this.colorReplaceSetting_) {
        return;
      }
      var consoleMode = pskl.app.consoleRegistry &&
                        pskl.app.consoleRegistry.getActive();
      var hasRestrictions = consoleMode && consoleMode.hasRestrictions();
      this.colorReplaceSetting_.style.display = hasRestrictions ? '' : 'none';
    };

  /**
   * Shows confirmation dialog for console mode switch.
   * Skips dialog if canvas is empty (nothing drawn).
   * @param {string} fromModeId - Current mode ID
   * @param {string} toModeId - Target mode ID
   * @return {boolean} True if user confirmed or canvas is empty
   * @private
   */
  ns.MiscPreferencesController.prototype.confirmConsoleModeChange_ = function (
    fromModeId, toModeId
  ) {
    // Skip warning if nothing is drawn
    if (this.piskelController.isEmpty()) {
      return true;
    }

    var registry = pskl.app.consoleRegistry;
    var fromMode = registry.get(fromModeId);
    var toMode = registry.get(toModeId);

    var fromName = fromMode ? fromMode.name : fromModeId;
    var toName = toMode ? toMode.name : toModeId;
    var toHasRestrictions = toMode && toMode.hasRestrictions();

    var msg;
    if (toHasRestrictions) {
      // Switching TO a restricted mode
      msg = 'Switching to ' + toName + '.\n\n' +
        'If your sprite uses colors not in this console\'s palette, they ' +
        'will remain but won\'t be valid for console-specific export.\n\n' +
        'Continue?';
    } else {
      // Switching TO unrestricted mode
      msg = 'Switching to ' + toName + '.\n\n' +
        'You will have access to the full color spectrum. ' +
        'Your current colors will be preserved.\n\n' +
        'Continue?';
    }
    return window.confirm(msg);
  };
})();
